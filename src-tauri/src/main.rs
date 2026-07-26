#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};

/// 统一迁移脚本的换行符，保证无论源码以 CRLF 还是 LF 检出，迁移校验指纹都一致。
fn migration_sql(raw: &'static str) -> &'static str {
    if raw.contains('\r') {
        Box::leak(raw.replace("\r\n", "\n").into_boxed_str())
    } else {
        raw
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:dayflow.db",
                    vec![Migration {
                        version: 1,
                        description: "create_dayflow_tables",
                        sql: migration_sql(include_str!("../migrations/0001_initial.sql")),
                        kind: MigrationKind::Up,
                    }, Migration {
                        version: 2,
                        description: "add_daily_reviews",
                        sql: migration_sql(include_str!("../migrations/0002_daily_reviews.sql")),
                        kind: MigrationKind::Up,
                    }, Migration {
                        version: 3,
                        description: "add_planning_features",
                        sql: migration_sql(include_str!("../migrations/0003_planning_features.sql")),
                        kind: MigrationKind::Up,
                    }, Migration {
                        version: 4,
                        description: "add_soft_delete",
                        sql: migration_sql(include_str!("../migrations/0004_soft_delete.sql")),
                        kind: MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "显示 Dayflow", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
            let mut tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("Dayflow · 温和的任务规划")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                ;
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Dayflow");
}
