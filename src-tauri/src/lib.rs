use serde::Serialize;
use email::backend::BackendBuilder;
use email::config::Config;
use email::envelope::list::{ListEnvelopes, ListEnvelopesOptions};
use email::imap::ImapContextBuilder;
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

// --- TOMLの厳格なパースエラーを回避するための独自構造体 ---
// ※ ライブラリが知らないフィールドがあっても無視して安全に読み込みます
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
// ------------------------------------------------------------

#[tauri::command]
async fn get_emails() -> Result<Vec<EmailEnvelope>, String> {
    // 1. 設定ファイルのパスを特定
    let config_path = env::var("HIMALAYA_CONFIG")
        .map(PathBuf::from)
        .ok()
        .or_else(|| dirs::config_dir().map(|p| p.join("himalaya/config.toml")))
        .ok_or_else(|| "設定ファイルが見つかりません".to_string())?;

    // 2. 読み込み
    let toml_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("設定ファイルの読み込みに失敗: {}", e))?;

    // 3. 独自構造体でパース（これで parse error を完全に回避）
    let app_config: AppConfig = toml::from_str(&toml_content)
        .map_err(|e| format!("TOMLの解析に失敗しました: {}", e))?;

    let (account_name, app_account) = app_config.accounts.into_iter().next()
        .ok_or("アカウントが設定されていません")?;

    // 4. email-libが要求する厳格なAccountConfigは、安全なダミー文字列から生成して騙す
    // 修正ポイント：name フィールドを追加しました
    let safe_toml = format!(
        "[accounts.{}]\nname = \"{}\"\nemail = \"{}\"",
        account_name, account_name, app_account.email
    );
    let strict_config: Config = toml::from_str(&safe_toml)
        .map_err(|e| format!("内部設定の生成エラー: {}", e))?;

    let account_config = Arc::new(strict_config.account(&account_name).unwrap().clone());
    let imap_config = Arc::new(app_account.imap);

    // 5. バックエンドの構築
    let ctx_builder = ImapContextBuilder::new(Arc::clone(&account_config), Arc::clone(&imap_config));

    let backend = BackendBuilder::new(Arc::clone(&account_config), ctx_builder)
        .build()
        .await
        .map_err(|e| format!("バックエンドの接続失敗: {}", e))?;

    // 6. メール一覧の取得
    let opts = ListEnvelopesOptions {
        page_size: 100,
        page: 0,
        query: None,
    };

    let envelopes = backend
        .list_envelopes("INBOX", opts)
        .await
        .map_err(|e| format!("メールの取得失敗: {}", e))?;

    // 7. フロントエンド用の型に変換
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
async fn send_email(to: String, subject: String, body: String) -> Result<String, String> {
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
        .invoke_handler(tauri::generate_handler![get_emails, send_email])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}