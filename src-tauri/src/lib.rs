use serde::Serialize;
use email::backend::BackendBuilder;
use email::config::Config;
use email::envelope::list::{ListEnvelopes, ListEnvelopesOptions};
use email::envelope::{Id, SingleId};
use email::imap::ImapContextBuilder;
use email::message::get::GetMessages;
use std::env;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailEnvelope {
    id: String,
    subject: String,
    from: String,
    date: String,
}

#[derive(serde::Deserialize)]
struct AppConfig {
    accounts: std::collections::HashMap<String, AppAccount>,
}

#[derive(serde::Deserialize)]
struct AppAccount {
    email: String,
    imap: email::imap::config::ImapConfig,
}

// 設定取得の共通関数（これがないと "Cannot find function" エラーになります）
async fn get_config_and_imap() -> Result<(Arc<Config>, String, email::imap::config::ImapConfig), String> {
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
        "[accounts.{}]\nname = \"{}\"\nemail = \"{}\"",
        account_name, account_name, app_account.email
    );
    let strict_config: Config = toml::from_str(&safe_toml)
        .map_err(|e| format!("内部設定の生成エラー: {}", e))?;

    Ok((Arc::new(strict_config), account_name, app_account.imap))
}

#[tauri::command]
async fn get_emails() -> Result<Vec<EmailEnvelope>, String> {
    let (config, account_name, imap_config) = get_config_and_imap().await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());

    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    let opts = ListEnvelopesOptions {
        page_size: 100,
        page: 0,
        query: None,
    };

    let envelopes = backend
        .list_envelopes("INBOX", opts)
        .await
        .map_err(|e| format!("メールの取得失敗: {}", e))?;

    let list = envelopes
        .into_iter()
        .map(|e| EmailEnvelope {
            id: e.id.to_string(),
            subject: e.subject.clone(),
            from: e.from.to_string(),
            date: e.date.to_string(),
        })
        .collect();

    Ok(list)
}

#[tauri::command]
async fn get_email_content(id: String) -> Result<String, String> {
    let (config, account_name, imap_config) = get_config_and_imap().await?;
    let account_config = Arc::new(config.account(&account_name).unwrap().clone());

    // ここを修正しました！
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::new(imap_config));
    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    // IDの組み立て
    let single_id = SingleId::from(id);
    let id_enum = Id::Single(single_id);

    // メッセージの取得
    let messages = backend
        .get_messages("INBOX", &id_enum)
        .await
        .map_err(|e| format!("メール本文の取得に失敗: {}", e))?;

    let email = messages
        .first()
        .ok_or_else(|| "メールが見つかりませんでした".to_string())?;

    let parsed = email.parsed().map_err(|e| format!("パースエラー: {}", e))?;

    // 型の不一致を避けるため、if let で確実に取り出して String に変換します
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
async fn send_email(to: String, subject: String, _body: String) -> Result<String, String> {
    log::info!("送信リクエストを受信: 宛先={}, 件名={}", to, subject);
    Ok("Rust側での送信処理の受け付けに成功しました（モック）".to_string())
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
            send_email
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}