use tauri_plugin_sql::{Migration, MigrationKind};

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:dayflow.db",
                    vec![Migration {
                        version: 1,
                        description: "create_dayflow_tables",
                        sql: include_str!("../migrations/0001_initial.sql"),
                        kind: MigrationKind::Up,
                    }, Migration {
                        version: 2,
                        description: "add_daily_reviews",
                        sql: include_str!("../migrations/0002_daily_reviews.sql"),
                        kind: MigrationKind::Up,
                    }, Migration {
                        version: 3,
                        description: "add_planning_features",
                        sql: include_str!("../migrations/0003_planning_features.sql"),
                        kind: MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Dayflow");
}
