import { SignInForm } from './SignInForm';

export const runtime = 'nodejs';

export default function SignInPage() {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="center-stack auth-stack">
          <div className="auth-brand">Acoru Memo</div>
          <div>
            <h1 className="auth-title">サインイン</h1>
            <p className="auth-description">
              いつものワークスペースに接続して、ノートを続きから編集しましょう。
            </p>
          </div>
          <SignInForm />
          <p className="auth-help">
            ログインできない場合は、管理者へパスワード再設定を依頼してください。
          </p>
        </div>
      </div>
    </div>
  );
}
