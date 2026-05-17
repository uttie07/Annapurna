use serde::{Serialize, Deserialize};
use email::backend::BackendBuilder;
use email::envelope::list::{ListEnvelopes, ListEnvelopesOptions};
use email::envelope::{Id, SingleId};
use email::imap::{ImapContextBuilder, config::ImapConfig};
use email::message::get::GetMessages;
use email::search_query::SearchEmailsQuery;
use email::search_query::filter::SearchEmailsFilterQuery;
use email::search_query::sort::{SearchEmailsSorter, SearchEmailsSorterKind, SearchEmailsSorterOrder};

use email::envelope::flag::add::AddFlags;
use email::envelope::flag::remove::RemoveFlags;
use email::flag::{Flag, Flags};
use email::message::delete::DeleteMessages;

use email::smtp::{SmtpContextBuilder, config::SmtpConfig};
use email::message::send::SendMessage;
use email::message::add::AddMessage;
use email::account::config::AccountConfig;

use std::env;
use std::path::PathBuf;
use std::sync::Arc;
use std::collections::HashMap;

// ====================================================================
// annapurna.toml のフラット構造を 100% 正確にパースする型定義
// ====================================================================
#[derive(Deserialize, Debug)]
pub struct AnnapurnaToml {
    pub accounts: HashMap<String, AnnapurnaAccount>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct AnnapurnaAccount {
    pub email: String,
    pub backend: ImapConfig,
    pub message: AnnapurnaMessageSection,
}

#[derive(Deserialize, Debug, Clone)]
pub struct AnnapurnaMessageSection {
    pub send: AnnapurnaSendSection,
}

#[derive(Deserialize, Debug, Clone)]
pub struct AnnapurnaSendSection {
    pub backend: SmtpConfig,
}

// フロントエンド用レスポンス型
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

// 専用設定ファイルのパス取得
fn get_annapurna_config_path() -> Result<PathBuf, String> {
    env::var("ANNAPURNA_CONFIG")
        .map(PathBuf::from)
        .ok()
        .or_else(|| dirs::config_dir().map(|p| p.join("annapurna/annapurna.toml")))
        .ok_or_else(|| "設定ファイルの格納ディレクトリが見つかりません".to_string())
}

// annapurna.toml を安全に読み込む共通関数
fn load_annapurna_toml() -> Result<AnnapurnaToml, String> {
    let config_path = get_annapurna_config_path()?;

    if !config_path.exists() {
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("ディレクトリ作成失敗: {}", e))?;
        }
        std::fs::write(&config_path, "").map_err(|e| format!("初期設定ファイル作成失敗: {}", e))?;
    }

    let toml_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("設定ファイルの読み込みに失敗: {}", e))?;

    let toml_data: AnnapurnaToml = toml::from_str(&toml_content)
        .map_err(|e| format!("annapurna.toml のパースに失敗しました。構造を確認してください: {}", e))?;

    Ok(toml_data)
}

// email-lib が内部で要求する共通の AccountConfig を動的に生成する関数
fn build_core_account_config(name: &str, raw: &AnnapurnaAccount) -> AccountConfig {
    AccountConfig {
        name: name.to_string(),
        email: raw.email.clone(),
        ..Default::default()
    }
}

#[tauri::command]
async fn get_accounts() -> Result<Vec<String>, String> {
    let toml_data = load_annapurna_toml()?;
    let mut names: Vec<String> = toml_data.accounts.keys().cloned().collect();
    names.sort();
    Ok(names)
}

#[tauri::command]
async fn add_account(
    auth_type: String,
    name: String,
    email: String,
    imap_host: String,
    imap_port: u16,
    smtp_host: String,
    smtp_port: u16,
    password_raw: String,
    client_id: String,
) -> Result<(), String> {
    let config_path = get_annapurna_config_path()?;

    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("ディレクトリ作成失敗: {}", e))?;
    }

    let account_toml = if auth_type == "ms365" {
        format!(
            r#"
[accounts.{0}]
email = "{1}"
backend.type = "imap"
backend.host = "outlook.office365.com"
backend.port = 993
backend.login = "{1}"
backend.auth.type = "oauth2"
backend.auth.method = "xoauth2"
backend.auth.client-id = "{2}"
backend.auth.access-token.keyring = "annapurna-{0}-access"
backend.auth.refresh-token.keyring = "annapurna-{0}-refresh"
backend.auth.auth-url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
backend.auth.token-url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
backend.auth.pkce = true
backend.auth.scopes = ["https://outlook.office.com/IMAP.AccessAsUser.All", "https://outlook.office.com/SMTP.Send", "offline_access"]

message.send.backend.type = "smtp"
message.send.backend.host = "smtp.office365.com"
message.send.backend.port = 587
message.send.backend.starttls = true
message.send.backend.login = "{1}"
message.send.backend.auth.type = "oauth2"
message.send.backend.auth.method = "xoauth2"
message.send.backend.auth.client-id = "{2}"
message.send.backend.auth.access-token.keyring = "annapurna-{0}-access"
message.send.backend.auth.refresh-token.keyring = "annapurna-{0}-refresh"
message.send.backend.auth.auth-url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
message.send.backend.auth.token-url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
message.send.backend.auth.pkce = true
message.send.backend.auth.scopes = ["https://outlook.office.com/IMAP.AccessAsUser.All", "https://outlook.office.com/SMTP.Send", "offline_access"]
"#,
            name, email, client_id
        )
    } else {
        format!(
            r#"
[accounts.{0}]
email = "{1}"
backend.type = "imap"
backend.host = "{2}"
backend.port = {3}
backend.login = "{1}"
backend.auth.type = "password"
backend.auth.raw = "{4}"

message.send.backend.type = "smtp"
message.send.backend.host = "{5}"
message.send.backend.port = {6}
message.send.backend.login = "{1}"
message.send.backend.auth.type = "password"
message.send.backend.auth.raw = "{4}"
"#,
            name, email, imap_host, imap_port, password_raw.replace('\'', "'\\''"), smtp_host, smtp_port
        )
    };

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

#[tauri::command]
async fn get_emails(account: String, folder: Option<String>, page: usize, page_size: usize) -> Result<EmailListResponse, String> {
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウントが見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let imap_config = Arc::new(raw_account.backend.clone());

    // 💡 修正: imap_config は最初から Arc なので、Arc::new で包み直さず Arc::clone でそのまま引き渡す！
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {:#?}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());
    let opts = ListEnvelopesOptions { page_size, page, query: None };

    let envelopes = backend
        .list_envelopes(&target_folder, opts)
        .await
        .map_err(|e| format!("メールの取得失敗: {:#?}", e))?;

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
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウントが見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let imap_config = Arc::new(raw_account.backend.clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {:#?}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());
    let id_enum = Id::Single(SingleId::from(id));

    let messages = backend
        .get_messages(&target_folder, &id_enum)
        .await
        .map_err(|e| format!("メール本文の取得に失敗: {:#?}", e))?;

    let email = messages.first().ok_or_else(|| "メールが見つかりませんでした".to_string())?;
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
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウント見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let imap_config = Arc::new(raw_account.backend.clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {:#?}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());

    let query = SearchEmailsQuery {
        filter: Some(SearchEmailsFilterQuery::From(address)),
        sort: Some(vec![SearchEmailsSorter::new(SearchEmailsSorterKind::Date, SearchEmailsSorterOrder::Descending)]),
    };

    let opts = ListEnvelopesOptions { page_size, page, query: Some(query) };

    let envelopes = backend
        .list_envelopes(&target_folder, opts)
        .await
        .map_err(|e| format!("サーバー検索の実行失敗: {:#?}", e))?;

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
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウントが見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let imap_config = Arc::new(raw_account.backend.clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {:#?}", e))?;

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
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウントが見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let imap_config = Arc::new(raw_account.backend.clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {:#?}", e))?;

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
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウントが見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let imap_config = Arc::new(raw_account.backend.clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {:#?}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());

    for id in ids {
        let target_id = Id::Single(SingleId::from(id));
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
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウントが見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let smtp_config = Arc::new(raw_account.message.send.backend.clone());

    // 💡 修正: SMTPビルダー側も同様に、Arc::new を外して Arc::clone で型を綺麗に一致させる
    let ctx_builder = SmtpContextBuilder::new(Arc::clone(&account_config), Arc::clone(&smtp_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("SMTPサーバーへの接続に失敗しました: {:#?}", e))?;

    let from = &account_config.email;
    let mut headers = format!("From: {}\r\nTo: {}", from, to);
    if let Some(c) = cc.filter(|s| !s.is_empty()) { headers.push_str(&format!("\r\nCc: {}", c)); }
    if let Some(b) = bcc.filter(|s| !s.is_empty()) { headers.push_str(&format!("\r\nBcc: {}", b)); }

    let raw_msg = format!("{}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}", headers, subject, body);
    backend.send_message(raw_msg.as_bytes()).await.map_err(|e| format!("メールの送信に失敗しました: {}", e))?;

    Ok("送信完了".to_string())
}

#[tauri::command]
async fn download_attachment(account: String, folder: Option<String>, id: String, filename: String) -> Result<Vec<u8>, String> {
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウントが見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let imap_config = Arc::new(raw_account.backend.clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {:#?}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());
    let id_enum = Id::Single(SingleId::from(id));

    let messages = backend.get_messages(&target_folder, &id_enum).await.map_err(|e| format!("メールの取得に失敗: {}", e))?;
    let email = messages.first().ok_or_else(|| "メールが見つかりませんでした".to_string())?;

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
    let toml_data = load_annapurna_toml()?;
    let raw_account = toml_data.accounts.get(&account).ok_or_else(|| "アカウントが見つかりません".to_string())?;

    let account_config = Arc::new(build_core_account_config(&account, raw_account));
    let imap_config = Arc::new(raw_account.backend.clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {:#?}", e))?;

    let from = &account_config.email;
    let mut headers = format!("From: {}\r\nTo: {}", from, to);
    if let Some(c) = cc.filter(|s| !s.is_empty()) { headers.push_str(&format!("\r\nCc: {}", c)); }
    if let Some(b) = bcc.filter(|s| !s.is_empty()) { headers.push_str(&format!("\r\nBcc: {}", b)); }

    let raw_msg = format!("{}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}", headers, subject, body);
    backend.add_message(&"drafts".to_string(), raw_msg.as_bytes()).await.map_err(|e| format!("下書きの保存に失敗: {}", e))?;

    Ok("下書きを保存しました".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
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