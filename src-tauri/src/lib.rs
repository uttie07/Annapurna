use serde::Serialize;
use email::backend::BackendBuilder;
use email::config::Config;
use email::envelope::list::{ListEnvelopes, ListEnvelopesOptions};
use email::envelope::{Id, SingleId};
use email::imap::ImapContextBuilder;
use email::message::get::GetMessages;
use email::search_query::SearchEmailsQuery;
use email::search_query::filter::SearchEmailsFilterQuery;
use email::search_query::sort::{SearchEmailsSorter, SearchEmailsSorterKind, SearchEmailsSorterOrder};

use email::envelope::flag::add::AddFlags;
use email::envelope::flag::remove::RemoveFlags;
use email::flag::{Flag, Flags};
use email::message::delete::DeleteMessages;

use email::smtp::SmtpContextBuilder;
use email::message::send::SendMessage;
use email::message::add::AddMessage;

use std::env;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailListResponse {
    emails: Vec<EmailEnvelope>,
    total_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailEnvelope {
    id: String,
    subject: String,
    from: String,
    to: String,
    date: String,
    flags: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailDetailResponse {
    pub body: String,
    pub attachments: Vec<String>,
}

// 💡 修正: ユーザー定義のフォルダエイリアスも読み取れるように構造体を追加
#[derive(serde::Deserialize, Clone)]
struct AppFolder {
    aliases: Option<std::collections::HashMap<String, String>>,
}

#[derive(serde::Deserialize)]
struct AppConfig {
    accounts: std::collections::HashMap<String, AppAccount>,
}

#[derive(serde::Deserialize, Clone)]
struct AppAccount {
    email: String,
    imap: email::imap::config::ImapConfig,
    smtp: Option<email::smtp::config::SmtpConfig>,
    folder: Option<AppFolder>, // 💡 追加
}

#[tauri::command]
async fn get_accounts() -> Result<Vec<String>, String> {
    let config_path = env::var("HIMALAYA_CONFIG")
        .map(PathBuf::from)
        .ok()
        .or_else(|| dirs::config_dir().map(|p| p.join("himalaya/config.toml")))
        .ok_or_else(|| "設定ファイルが見つかりません".to_string())?;

    let toml_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("設定ファイルの読み込みに失敗: {}", e))?;

    let app_config: AppConfig = toml::from_str(&toml_content)
        .map_err(|e| format!("TOMLの解析に失敗しました: {}", e))?;

    let mut names: Vec<String> = app_config.accounts.keys().cloned().collect();
    names.sort();
    Ok(names)
}

#[tauri::command]
async fn add_account(
    name: String,
    email: String,
    imap_host: String,
    imap_port: u16,
    smtp_host: String,
    smtp_port: u16,
    password_raw: String,
) -> Result<(), String> {
    let config_path = env::var("HIMALAYA_CONFIG")
        .map(PathBuf::from)
        .ok()
        .or_else(|| dirs::config_dir().map(|p| p.join("himalaya/config.toml")))
        .ok_or_else(|| "設定ファイルが見つかりません".to_string())?;

    let account_toml = format!(
        r#"
[accounts.{}]
email = "{}"

[accounts.{}.imap]
host = "{}"
port = {}
login = "{}"
auth.type = "password"
auth.raw = "{}"

[accounts.{}.smtp]
host = "{}"
port = {}
login = "{}"
auth.type = "password"
auth.raw = "{}"
"#,
        name, email,
        name, imap_host, imap_port, email, password_raw,
        name, smtp_host, smtp_port, email, password_raw
    );

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(&config_path)
        .map_err(|e| format!("設定ファイルを開けませんでした: {}", e))?;

    file.write_all(account_toml.as_bytes())
        .map_err(|e| format!("設定ファイルへの書き込みに失敗しました: {}", e))?;

    Ok(())
}

async fn get_config_for_account(target_account: &str) -> Result<(Arc<Config>, String, email::imap::config::ImapConfig, Option<email::smtp::config::SmtpConfig>), String> {
    let config_path = env::var("HIMALAYA_CONFIG")
        .map(PathBuf::from)
        .ok()
        .or_else(|| dirs::config_dir().map(|p| p.join("himalaya/config.toml")))
        .ok_or_else(|| "設定ファイルが見つかりません".to_string())?;

    let toml_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("設定ファイルの読み込みに失敗: {}", e))?;

    let app_config: AppConfig = toml::from_str(&toml_content)
        .map_err(|e| format!("TOMLの解析に失敗しました: {}", e))?;

    let app_account = app_config.accounts.get(target_account)
        .ok_or_else(|| format!("アカウント '{}' が見つかりません", target_account))?;

    // 💡 修正: ホスト名からゴミ箱などのフォルダ名を自動推測する
    let host = app_account.imap.host.to_lowercase();
    let mut trash = "Trash".to_string();
    let mut sent = "Sent".to_string();
    let mut drafts = "Drafts".to_string();

    if host.contains("gmail") {
        trash = "[Gmail]/ゴミ箱".to_string();
        sent = "[Gmail]/送信済みメール".to_string();
        drafts = "[Gmail]/下書き".to_string();
    } else if host.contains("yahoo.co.jp") {
        trash = "ゴミ箱".to_string();
        sent = "送信済みメール".to_string();
        drafts = "下書き".to_string();
    }

    // もしユーザーがconfig.tomlに直接エイリアスを書いていたらそれを優先
    if let Some(folder) = &app_account.folder {
        if let Some(aliases) = &folder.aliases {
            if let Some(t) = aliases.get("trash") { trash = t.clone(); }
            if let Some(s) = aliases.get("sent") { sent = s.clone(); }
            if let Some(d) = aliases.get("drafts") { drafts = d.clone(); }
        }
    }

    let safe_toml = format!(
        r#"
[accounts."{}"]
name = "{}"
email = "{}"

[accounts."{}".folder.aliases]
trash = "{}"
sent = "{}"
drafts = "{}"
"#,
        target_account, target_account, app_account.email, target_account, trash, sent, drafts
    );

    let strict_config: Config = toml::from_str(&safe_toml)
        .map_err(|e| format!("内部設定の生成エラー: {}", e))?;

    Ok((Arc::new(strict_config), target_account.to_string(), app_account.imap.clone(), app_account.smtp.clone()))
}

#[tauri::command]
async fn get_emails(account: String, folder: Option<String>, page: usize, page_size: usize) -> Result<EmailListResponse, String> {
    let (config, account_name, imap_config, _) = get_config_for_account(&account).await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());

    let opts = ListEnvelopesOptions {
        page_size,
        page,
        query: None,
    };

    let envelopes = backend
        .list_envelopes(&target_folder, opts)
        .await
        .map_err(|e| format!("メールの取得失敗: {}", e))?;

    let total_count = envelopes.len();

    let emails = envelopes
        .into_iter()
        .map(|e| EmailEnvelope {
            id: e.id.to_string(),
            subject: e.subject.clone(),
            from: e.from.to_string(),
            to: e.to.to_string(),
            date: e.date.to_string(),
            flags: e.flags.iter().map(|f| f.to_string()).collect(),
        })
        .collect();

    Ok(EmailListResponse { emails, total_count })
}

#[tauri::command]
async fn get_email_content(account: String, folder: Option<String>, id: String) -> Result<EmailDetailResponse, String> {
    let (config, account_name, imap_config, _) = get_config_for_account(&account).await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());
    let single_id = SingleId::from(id);
    let id_enum = Id::Single(single_id);

    let messages = backend
        .get_messages(&target_folder, &id_enum)
        .await
        .map_err(|e| format!("メール本文の取得に失敗: {}", e))?;

    let email = messages
        .first()
        .ok_or_else(|| "メールが見つかりませんでした".to_string())?;

    let parsed = email.parsed().map_err(|e| format!("パースエラー: {}", e))?;

    let content = if let Some(html) = parsed.body_html(0) {
        html.to_string()
    } else if let Some(text) = parsed.body_text(0) {
        text.to_string()
    } else {
        "本文がありません".to_string()
    };

    let mut attachments = Vec::new();
    if let Ok(att_vec) = email.attachments() {
        for att in att_vec.iter() {
            let name = att.filename.clone().unwrap_or_else(|| "untitled_file".to_string());
            attachments.push(name);
        }
    }

    Ok(EmailDetailResponse { body: content, attachments })
}

#[tauri::command]
async fn search_emails_on_server(account: String, folder: Option<String>, address: String, page: usize, page_size: usize) -> Result<EmailListResponse, String> {
    let (config, account_name, imap_config, _) = get_config_for_account(&account).await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());

    let query = SearchEmailsQuery {
        filter: Some(SearchEmailsFilterQuery::From(address)),
        sort: Some(vec![
            SearchEmailsSorter::new(
                SearchEmailsSorterKind::Date,
                SearchEmailsSorterOrder::Descending,
            ),
        ]),
    };

    let opts = ListEnvelopesOptions {
        page_size,
        page,
        query: Some(query),
    };

    let envelopes = backend
        .list_envelopes(&target_folder, opts)
        .await
        .map_err(|e| format!("サーバー検索の実行失敗: {}", e))?;

    let total_count = envelopes.len();

    let emails = envelopes
        .into_iter()
        .map(|e| EmailEnvelope {
            id: e.id.to_string(),
            subject: e.subject.clone(),
            from: e.from.to_string(),
            to: e.to.to_string(),
            date: e.date.to_string(),
            flags: e.flags.iter().map(|f| f.to_string()).collect(),
        })
        .collect();

    Ok(EmailListResponse { emails, total_count })
}

#[tauri::command]
async fn add_email_flags(account: String, folder: Option<String>, ids: Vec<String>, flags: Vec<String>) -> Result<(), String> {
    let (config, account_name, imap_config, _) = get_config_for_account(&account).await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());
    let target_flags = Flags::from_iter(flags.into_iter().map(|f| match f.as_str() {
        "Seen" => Flag::Seen,
        "Flagged" => Flag::Flagged,
        "Deleted" => Flag::Deleted,
        "Answered" => Flag::Answered,
        "Draft" => Flag::Draft,
        _ => Flag::Custom(f),
    }));

    for id in ids {
        let target_id = Id::Single(SingleId::from(id));
        backend.add_flags(&target_folder, &target_id, &target_flags).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn remove_email_flags(account: String, folder: Option<String>, ids: Vec<String>, flags: Vec<String>) -> Result<(), String> {
    let (config, account_name, imap_config, _) = get_config_for_account(&account).await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());
    let target_flags = Flags::from_iter(flags.into_iter().map(|f| match f.as_str() {
        "Seen" => Flag::Seen,
        "Flagged" => Flag::Flagged,
        "Deleted" => Flag::Deleted,
        "Answered" => Flag::Answered,
        "Draft" => Flag::Draft,
        _ => Flag::Custom(f),
    }));

    for id in ids {
        let target_id = Id::Single(SingleId::from(id));
        backend.remove_flags(&target_folder, &target_id, &target_flags).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn delete_emails(account: String, folder: Option<String>, ids: Vec<String>) -> Result<(), String> {
    let (config, account_name, imap_config, _) = get_config_for_account(&account).await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());

    for id in ids {
        let target_id = Id::Single(SingleId::from(id));
        // 💡 修正: ゴミ箱への移動に失敗した場合は、直接「削除済みフラグ」を立てるフォールバック機構を追加！
        if let Err(e) = backend.delete_messages(&target_folder, &target_id).await {
            log::warn!("ゴミ箱への移動に失敗: {}, 代わりに直接削除フラグを付与します", e);
            let flags = Flags::from_iter(vec![Flag::Deleted]);
            backend.add_flags(&target_folder, &target_id, &flags).await
                .map_err(|e2| format!("ゴミ箱への移動にも、削除フラグの付与にも失敗しました (MoveError: {}, FlagError: {})", e, e2))?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn send_email(account: String, to: String, cc: Option<String>, bcc: Option<String>, subject: String, body: String) -> Result<String, String> {
    let (config, account_name, _, smtp_opt) = get_config_for_account(&account).await?;
    let smtp_config = smtp_opt.ok_or_else(|| "SMTP設定が見つかりません。設定ファイルを確認してください。".to_string())?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());

    let ctx_builder = SmtpContextBuilder::new(Arc::clone(&account_config), Arc::new(smtp_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("SMTPサーバーへの接続に失敗しました: {}", e))?;

    let from = &account_config.email;

    let mut headers = format!("From: {}\r\nTo: {}", from, to);
    if let Some(c) = cc.filter(|s| !s.is_empty()) {
        headers.push_str(&format!("\r\nCc: {}", c));
    }
    if let Some(b) = bcc.filter(|s| !s.is_empty()) {
        headers.push_str(&format!("\r\nBcc: {}", b));
    }

    let raw_msg = format!(
        "{}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}",
        headers, subject, body
    );

    log::info!("送信リクエストを開始: 宛先={}, 件名={}", to, subject);

    backend.send_message(raw_msg.as_bytes()).await.map_err(|e| format!("メールの送信に失敗しました: {}", e))?;

    Ok("送信完了".to_string())
}

#[tauri::command]
async fn download_attachment(account: String, folder: Option<String>, id: String, filename: String) -> Result<Vec<u8>, String> {
    let (config, account_name, imap_config, _) = get_config_for_account(&account).await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());
    let single_id = SingleId::from(id);
    let id_enum = Id::Single(single_id);

    let messages = backend
        .get_messages(&target_folder, &id_enum)
        .await
        .map_err(|e| format!("メールの取得に失敗: {}", e))?;

    let email = messages
        .first()
        .ok_or_else(|| "メールが見つかりませんでした".to_string())?;

    if let Ok(att_vec) = email.attachments() {
        for att in att_vec.iter() {
            if att.filename.as_deref() == Some(filename.as_str()) {
                return Ok(att.body.clone());
            }
        }
    }

    Err("添付ファイルが見つかりません".to_string())
}

#[tauri::command]
async fn save_draft(account: String, to: String, cc: Option<String>, bcc: Option<String>, subject: String, body: String) -> Result<String, String> {
    let (config, account_name, imap_config, _) = get_config_for_account(&account).await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let from = &account_config.email;

    let mut headers = format!("From: {}\r\nTo: {}", from, to);
    if let Some(c) = cc.filter(|s| !s.is_empty()) {
        headers.push_str(&format!("\r\nCc: {}", c));
    }
    if let Some(b) = bcc.filter(|s| !s.is_empty()) {
        headers.push_str(&format!("\r\nBcc: {}", b));
    }

    let raw_msg = format!(
        "{}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}",
        headers, subject, body
    );

    let target_folder = "drafts".to_string();

    backend
        .add_message(&target_folder, raw_msg.as_bytes())
        .await
        .map_err(|e| format!("下書きの保存に失敗: {}", e))?;

    Ok("下書きを保存しました".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            add_account,
            get_emails,
            get_email_content,
            search_emails_on_server,
            add_email_flags,
            remove_email_flags,
            delete_emails,
            send_email,
            download_attachment,
            save_draft
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}