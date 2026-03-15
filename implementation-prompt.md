# RehaScope - 実装指示プロンプト

**対象AIコーディングツール：** Cursor / GitHub Copilot / AntiGravity 等
**バージョン：** 1.0
**作成日：** 2026-03-15

---

## このプロンプトの使い方

このファイルをAIコーディングツールに渡し、
「このプロンプトに従ってアプリを実装してください」と指示してください。
`spec.md`・`test-spec.md`・`rls-design.md` も同時に参照させてください。

---

## 実装指示プロンプト

```
あなたはNext.js・TypeScript・MediaPipe・Tailwind CSSのエキスパートです。
以下の仕様に従って「RehaScope」という理学療法士向け動作分析Webアプリを実装してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ アプリ概要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

アプリ名：RehaScope
目的：理学療法士が患者の動作をスマホ/タブレットで撮影し、
      MediaPipeによる骨格推定で関節角度・重心偏位を計測。
      介入前後（Before/After）の変化を可視化する。
デバイス：iPad（タブレット横持ち）メイン
デザイン：医療系・清潔感重視（白×紺×グレー）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 技術スタック
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Next.js 14（App Router）+ TypeScript
- Tailwind CSS
- @mediapipe/pose（Web版・ブラウザ完結）
- next-pwa（PWA・オフライン対応）
- jsPDF + html2canvas（PDF生成）
- Jest + React Testing Library（テスト）
- Vercel（デプロイ先）
- DB/バックエンド：なし（完全フロントエンド）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 画面構成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【SCR-01】パスワード認証画面（/）
- 画面中央にパスワード入力フォームと「入室する」ボタン
- 正しいパスワード（環境変数 NEXT_PUBLIC_APP_PASSWORD）と一致したら /home へ遷移
- 不一致の場合「パスワードが違います」エラー表示
- 認証成功時：sessionStorage と Cookie に "reha_auth": "true" を保存

【SCR-02】ホーム・動作選択画面（/home）
- ヘッダー：左に「RehaScope」ロゴ、右に「Motion Analysis Tool」
- メイン：3つの大きなカードボタン
  - 「立ち上がり」（アイコン + 説明文）
  - 「歩行」（アイコン + 説明文）
  - 「バランス・静止立位」（アイコン + 説明文）
- カードクリックで動画入力画面（/input）へ遷移（動作種類をstateで渡す）

【SCR-03】動画入力画面（/input）
- ヘッダーに選択した動作種類を表示
- 撮影面選択トグル：「前額面」「矢状面」「両方」
- 選択に応じた動画入力エリア表示：
  - 前額面のみ：Before/After × 2エリア
  - 矢状面のみ：Before/After × 2エリア
  - 両方：前額面Before/After・矢状面Before/After × 4エリア
- 各エリアに「録画する」ボタン（カメラ起動）と「ファイルを選択」ボタン
- 必須動画が揃ったら「分析開始」ボタンが有効化 → /analysis へ遷移

【SCR-04】分析・比較画面（/analysis）
- 両面選択時：タブで「前額面」「矢状面」切り替え
- 単面選択時：タブなし
- 各タブ内レイアウト：
  - 上部：Before（左・青枠）/ After（右・橙枠）の動画を左右並列表示
  - 動画下：同期再生コントロール（再生/停止/リセット）
  - 下部左：関節角度の時系列グラフ（recharts使用推奨）
    - 股関節・膝関節・足関節・体幹傾斜角
    - Before：青線 / After：橙線
  - 下部右：足底アウトライン上の重心位置プロット（SVGで実装）
- 右上：「PDF出力」「CSVエクスポート」ボタン
- フレーム指定ボタンで SCR-05 モーダルを開く

【SCR-05】フレームスナップショット（モーダル or ページ）
- Before/After の静止フレームを左右表示
- 各フレームにスティックフィギュアと関節角度ラベルをオーバーレイ
- 各動画下にフレームスクラバー（input[type=range]）
- 下部に比較テーブル：関節名 / Before値 / After値 / Δ（差分）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 実装するコンポーネント・ライブラリ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【lib/mediapipe.ts】
- MediaPipe Pose の初期化・モデルロード
- sendVideoFrame(videoElement, callback) 関数
  → 各フレームのランドマーク座標（33点）を返す
- analyzePose(results) 関数
  → poseLandmarks が null なら null を返す

【lib/angleCalc.ts】
- calculateHipAngle(landmarks): number
- calculateKneeAngle(landmarks): number
- calculateAnkleAngle(landmarks): number
- calculateTrunkAngle(landmarks): number
- 全角度はMediaPipe Poseランドマーク番号を使って3点ベクトルで計算
  （参考：MediaPipe Pose landmark indices）

【lib/gravityCalc.ts】
- calculateCenterOfGravity(landmarks): { x: number, y: number }
  → 主要ランドマーク（肩・腰・膝・足首）の加重平均で推定

【lib/pdfExport.ts】
- generatePdf(elementId: string, fileName: string): void
  → html2canvas で要素をキャプチャ → jsPDF で PDF化 → ダウンロード
- generateFileName({ date, movementType, plane, extension }): string
  → 例："20260315_standing_sagittal.pdf"

【lib/csvExport.ts】
- generateCsv({ before, after }): string
  → フレームごとの角度データをCSV文字列で返す
- downloadCsv(fileName: string, data: string): void

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ ルートガード・認証
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- middleware.ts でルートガード実装
- /home・/input・/analysis にアクセス時、Cookie "reha_auth" が "true" でなければ / にリダイレクト
- PasswordGate コンポーネントでパスワード照合
- パスワードは process.env.NEXT_PUBLIC_APP_PASSWORD と照合

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ PWA設定
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- next-pwa を使用
- next.config.js に PWA設定を追加
- public/manifest.json を作成（name: "RehaScope"、short_name: "RehaScope"）
- MediaPipe モデルファイルもService Workerでキャッシュ対象にする
- icons/ フォルダにPWAアイコン（192x192・512x512）を配置

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ デザイン仕様
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

カラーパレット（Tailwind CSS設定）：
- Primary: #1e3a5f（紺）
- Secondary: #3b82f6（青）
- Accent: #f97316（橙 ※Afterの色）
- Background: #f8fafc（薄グレー）
- Surface: #ffffff（白）
- Error: #ef4444（赤）

フォント：
- 日本語：Noto Sans JP
- 数値・英語：Inter

コンポーネントスタイル：
- カード：rounded-xl shadow-md bg-white
- ボタン（Primary）：bg-blue-600 text-white rounded-lg px-6 py-3
- ボタン（Secondary）：border border-blue-600 text-blue-600 rounded-lg
- Before動画枠：border-2 border-blue-500
- After動画枠：border-2 border-orange-500

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ エラーハンドリング
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 動画以外のファイルアップロード時：「動画ファイルを選択してください」
- Before/After未選択で分析開始：「Before・Afterの動画を選択してください」
- MediaPipe骨格未検出時：「骨格を検出できませんでした。撮影角度を確認してください」
- カメラアクセス拒否時：「カメラへのアクセスを許可してください」

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 実装順序（推奨）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. プロジェクト初期化（Next.js + TypeScript + Tailwind）
2. PWA設定（next-pwa + manifest.json）
3. ルートガード（middleware.ts + PasswordGate）
4. ホーム画面（MovementSelector）
5. 動画入力画面（VideoInput + カメラ/ファイル対応）
6. MediaPipe統合（lib/mediapipe.ts + angleCalc.ts + gravityCalc.ts）
7. 分析・比較画面（VideoPlayer + AngleGraph + GravityPlot）
8. フレームスナップショット（FrameScrubber + PoseOverlay + AngleTable）
9. エクスポート機能（pdfExport + csvExport）
10. テスト実装（test-spec.md に従って）
11. Vercelデプロイ設定

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 環境変数
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

.env.local に以下を追加（Gitにコミットしないこと）：
NEXT_PUBLIC_APP_PASSWORD=（職場で決めたパスワード）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 制約事項
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 動画データをサーバーに送信しないこと（ブラウザ内処理のみ）
- 患者の個人情報を保存する機能を実装しないこと
- Firebase/Supabase等のバックエンドサービスは使用しないこと
- すべての処理はクライアントサイドで完結させること
```
