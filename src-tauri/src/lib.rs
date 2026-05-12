use serde::Serialize;

// フロントエンドへ渡すためのデータ構造
#[derive(Serialize)]
struct EmailEnvelope {
    id: String,
    subject: String,
    from: String,
    date: String,
}

// Reactから呼び出すコマンド
#[tauri::command]
async fn get_emails() -> Result<Vec<EmailEnvelope>, String> {
    // Week 2: ここを libhimalaya の実処理に置き換えて IMAP 操作を行います [cite: 18, 22]
    // 現時点では React との接続を確認するためモックデータを返します
    Ok(vec![
        EmailEnvelope {
            id: "227473".into(),
            subject: "セキュリティ通知".into(),
            from: "Google".into(),
            date: "2026-05-11".into(),
        },
        EmailEnvelope {
            id: "227465".into(),
            subject: "SalesforceとExcelの二重管理を無くす".into(),
            from: "マッシュマトリックス".into(),
            date: "2026-05-11".into(),
        },
    ])
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
        // コマンドを登録
        .invoke_handler(tauri::generate_handler![get_emails])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}