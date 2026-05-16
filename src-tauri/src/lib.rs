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

#[derive(serde::Deserialize)]
struct AppConfig {
    accounts: std::collections::HashMap<String, AppAccount>,
}

#[derive(serde::Deserialize)]
struct AppAccount {
    email: String,
    imap: email::imap::config::ImapConfig,
    smtp: Option<email::smtp::config::SmtpConfig>,
}

async fn get_full_config() -> Result<(Arc<Config>, String, email::imap::config::ImapConfig, Option<email::smtp::config::SmtpConfig>), String> {
    let config_path = env::var("HIMALAYA_CONFIG")
        .map(PathBuf::from)
        .ok()
        .or_else(|| dirs::config_dir().map(|p| p.join("himalaya/config.toml")))
        .ok_or_else(|| "設定ファイルが見つかりません".to_string())?;

    let toml_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("設定ファイルの読み込みに失敗: {}", e))?;

    let app_config: AppConfig = toml::from_str(&toml_content)
        .map_err(|e| format!("TOMLの解析に失敗しました: {}", e))?;

    let (account_name, app_account) = app_config.accounts.into_iter().next()
        .ok_or("アカウントが設定されていません")?;

    let safe_toml = format!(
        r#"
[accounts."{}"]
name = "{}"
email = "{}"

[accounts."{}".folder.aliases]
trash = "[Gmail]/ゴミ箱"
sent = "[Gmail]/送信済みメール"
drafts = "[Gmail]/下書き"
"#,
        account_name, account_name, app_account.email, account_name
    );

    let strict_config: Config = toml::from_str(&safe_toml)
        .map_err(|e| format!("内部設定の生成エラー: {}", e))?;

    Ok((Arc::new(strict_config), account_name, app_account.imap, app_account.smtp))
}

#[tauri::command]
async fn get_emails(folder: Option<String>, page: usize, page_size: usize) -> Result<EmailListResponse, String> {
    let (config, account_name, imap_config, _) = get_full_config().await?;
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

// 💡 修正: 対象のフォルダを引数で受け取るように変更
#[tauri::command]
async fn get_email_content(folder: Option<String>, id: String) -> Result<String, String> {
    let (config, account_name, imap_config, _) = get_full_config().await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());
    let single_id = SingleId::from(id);
    let id_enum = Id::Single(single_id);

    // INBOX固定ではなく target_folder を指定
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

    Ok(content)
}

#[tauri::command]
async fn search_emails_on_server(folder: Option<String>, address: String, page: usize, page_size: usize) -> Result<EmailListResponse, String> {
    let (config, account_name, imap_config, _) = get_full_config().await?;
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

// 💡 修正: フラグ操作なども対象フォルダを指定できるように変更
#[tauri::command]
async fn add_email_flags(folder: Option<String>, ids: Vec<String>, flags: Vec<String>) -> Result<(), String> {
    let (config, account_name, imap_config, _) = get_full_config().await?;
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
async fn remove_email_flags(folder: Option<String>, ids: Vec<String>, flags: Vec<String>) -> Result<(), String> {
    let (config, account_name, imap_config, _) = get_full_config().await?;
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
async fn delete_emails(folder: Option<String>, ids: Vec<String>) -> Result<(), String> {
    let (config, account_name, imap_config, _) = get_full_config().await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let target_folder = folder.unwrap_or_else(|| "INBOX".to_string());

    for id in ids {
        let target_id = Id::Single(SingleId::from(id));
        backend.delete_messages(&target_folder, &target_id).await.map_err(|e| format!("削除失敗: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn send_email(to: String, subject: String, body: String) -> Result<String, String> {
    let (config, account_name, _, smtp_opt) = get_full_config().await?;
    let smtp_config = smtp_opt.ok_or_else(|| "SMTP設定が見つかりません。設定ファイルを確認してください。".to_string())?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());

    let ctx_builder = SmtpContextBuilder::new(Arc::clone(&account_config), Arc::new(smtp_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("SMTPサーバーへの接続に失敗しました: {}", e))?;

    let from = &account_config.email;

    let raw_msg = format!(
        "From: {}\r\nTo: {}\r\nSubject: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{}",
        from, to, subject, body
    );

    log::info!("送信リクエストを開始: 宛先={}, 件名={}", to, subject);

    backend.send_message(raw_msg.as_bytes()).await.map_err(|e| format!("メールの送信に失敗しました: {}", e))?;

    Ok("送信完了".to_string())
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
            get_emails,
            get_email_content,
            search_emails_on_server,
            add_email_flags,
            remove_email_flags,
            delete_emails,
            send_email
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}