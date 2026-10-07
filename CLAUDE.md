# マスター管理の開発

@AGENTS.md

READMEとAGENTSの約束を正本とします。データは`master_kinds`（項目定義）、`master_rows`（値と版）、`master_history`（自己申告名・日時・変更前後）の3テーブルです。マイグレーションはAppThrustのDatabaseChangeが適用し、アプリ起動時には実行しません。変更はServer Actions経由で検証し、行と履歴を同一トランザクションで保存してください。
