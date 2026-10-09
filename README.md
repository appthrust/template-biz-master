# マスター管理

取引先・商品・部署など、業務の基本情報を一か所で管理するアプリです。Next.js App Router / Server Actions / PostgreSQL (`pg`) で構成しています。

## できること

- 取引先・商品・部署を初期登録。それぞれ3件の架空サンプルが入っています。
- 「マスターを追加」から独自のマスターと登録項目を作成。項目名、文字・数値・日付・選択肢、必須設定を指定できます（1〜20項目）。
- 行の追加・編集・削除、すべての項目を対象とした検索、項目別の昇順・降順表示。
- CSV取込：UTF-8、見出し行あり、200KB・1000件まで。項目とCSV列の対応を選び、先頭3件を確認してから追加します。既存行は上書きしません。全件をサーバーで検証し、1件でも不正なら全件を取り消します。
- CSV書き出し：表示中の検索結果・並び順をUTF-8 BOM付きで保存します。文字列が数式として実行されないよう、`= + - @` で始まる文字セルには先頭に `'` を付けます（再取込時も文字として残ります）。数値型の負数はそのままです。
- 変更履歴：直近100件の操作、名前、日時（日本時間）、変更前後の値を表示。削除した行の内容も残ります。
- スマートフォンでは一覧が縦並びになり、登録・編集・CSV操作もできます。

「記録する名前」は自己申告です。入力値はそのブラウザーに保存します。**アプリ内には認証・権限管理を実装していません。** 公開先のSSO・アクセス制御を利用してください。履歴は本人確認済みの監査証跡ではありません。

マスター作成後の項目定義変更・マスター削除は提供していません。行は編集・削除できます。マスター名は一意ですが、行の各値に一意制約はありません。

## ローカルで動かす

Node.js 24とPostgreSQL 17を用意し、空の専用データベースを作成します。

```bash
npm ci
export DATABASE_URL='postgresql://app:password@localhost:5432/app'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0002_master.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0003_labels.sql
npm run dev
```

`http://localhost:3000` を開きます。接続できない、またはマイグレーション未適用の場合は、準備中の案内を表示し、架空データへの切り替えはしません。

```bash
node --experimental-strip-types --test lib/master.test.mjs
npm run build
```

## データモデル

| テーブル | 主な列 | 用途 |
| --- | --- | --- |
| `master_kinds` | `id UUID`, `name TEXT UNIQUE`, `fields JSONB`, `created_at` | マスター名と項目定義。`fields` は `{ id, name, type, required, options }[]`。項目IDはマスター内で `f1`, `f2`…、型は `text / number / date / select`。 |
| `master_rows` | `id UUID`, `master_id UUID`, `values JSONB`, `version INTEGER`, `created_at`, `updated_at` | マスターの行。`values` は項目IDをキーとした文字列または数値。任意項目の空欄は空文字。`version` で同時編集による上書きを検出。 |
| `master_history` | `id BIGSERIAL`, `master_id`, `row_id`, `action`, `actor`, `before_values`, `after_values`, `created_at` | `master / create / update / delete / import` を記録。行との外部キーを持たず、削除後も履歴を保存。 |

すべての行操作と履歴の書き込みは同じトランザクションで確定します。編集・削除は対象行をロックし、読み込み時の版と違う場合は保存せず再読み込みを案内します。入力はサーバーで必須、有限数値、実在する日付、定義済みの選択肢を再検証します。

`0001_init.sql` は元ひな形のメッセージテーブルを保持する既存履歴です。アプリはそのテーブルを使用しません。マスター用のスキーマは `0002_master.sql` に独立しています。再適用可能なDDLと初期データを使用し、既存マスターを上書きせず、削除済みサンプル行も復元しません。
`0003_labels.sql` はデータタブに表示する表・列の日本語名をコメントとして設定します。

## AppThrustでの公開

`appthrust/template-nextjs` と同じ配置です。`DATABASE_URL` は基盤から渡され、**`db/migrations/*.sql` はAppThrustのDatabaseChangeで適用します。アプリ起動時にはマイグレーションしません。** マイグレーションの完了後にアプリを利用できます。

`Dockerfile` と `.github/workflows/deploy.yml` は元ひな形のままです。`main` へのpushで `Docker Build and Push` が起動し、`ghcr.io/appthrust/template-biz-master:edge-<日時>` が生成されます。アプリの待受ポートは3000です。

## 実装の入口

- `app/page.tsx`：サーバーで一覧・履歴を読む。
- `app/master-app.tsx`：日本語の一覧・登録・項目定義・CSV列マッピング・履歴画面。
- `app/actions.ts`：検証付きServer Actionsとトランザクション。
- `lib/master.ts`：共有する型、項目・値の検証、CSV処理。
- `lib/db.ts`：`pg`の接続、パラメーター付きクエリ、履歴保存。
- `db/migrations/0002_master.sql`：スキーマと初期サンプル。
- `db/migrations/0003_labels.sql`：データタブの表・列の日本語名。
