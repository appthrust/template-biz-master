# 開発ガイド

このアプリは、日本語・モバイル対応の汎用マスター管理です。READMEの利用方法とデータモデルを先に読んでください。

## 構成とデータモデル

- Next.js 16 App Router、React 19、`pg`。このバージョンのAPIを推測せず、`node_modules/next/dist/docs/` の該当ガイドを確認してください。
- `master_kinds.fields` は `{ id, name, type, required, options }[]`。`type` は `text / number / date / select`。
- `master_rows.values` は項目IDをキーにした文字列・数値。任意項目の空欄は空文字です。
- `master_history` は自己申告名と操作時刻、操作種別、変更前後を保存。行を削除しても履歴は保持します。
- 更新・削除は行ロックと`version`確認を行い、履歴を同一トランザクションで書き込みます。

## 変更時の約束

1. データ変更は`app/actions.ts`のServer Actionsに集約し、`lib/master.ts`で必須・型・選択肢をサーバー側でも検証します。
2. SQLはパラメーター化します。CSVは全行を検証してから同一トランザクションで追加し、部分的な成功にしません。
3. スキーマ変更は`db/migrations/`へ追加します。既存の適用済みマイグレーションを変更せず、再適用可能にします。AppThrustのDatabaseChangeが適用するため、起動時マイグレーションは禁止です。
4. `Dockerfile`、`.github/workflows/deploy.yml`の標準配置・公開方式を維持します。
5. アプリ内認証はありません。アクセス制御は公開先のSSOに任せ、自己申告名を認証済みユーザーとして扱いません。
6. UIは業務担当者向けの日本語を使います。エラー時に入力を保持し、何を直せばよいかを示します。スマートフォン・キーボード・ダイアログのフォーカスを確認します。
7. 変更後は`node --experimental-strip-types --test lib/master.test.mjs`と`npm run build`を実行し、READMEの仕様を同期します。CSV・入力検証を変えたら対応する回帰テストも更新します。
