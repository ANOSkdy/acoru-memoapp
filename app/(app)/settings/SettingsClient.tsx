'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { ActionState } from './actions';
import {
  adminCreateUser,
  changePassword,
  updatePreferences,
  updateProfile
} from './actions';

const initialState: ActionState = {
  ok: false,
  error: undefined,
  fieldErrors: undefined,
  tempPassword: undefined
};

type Preferences = {
  ui: {
    compactMode: boolean;
    reduceMotion: boolean;
  };
  editor: {
    defaultBlockType: 'paragraph' | 'todo';
  };
};

type SettingsClientProps = {
  user: {
    email: string;
    displayName: string;
  };
  preferences: Preferences;
  isAdmin: boolean;
};

const SubmitButton = ({ label, pendingLabel }: { label: string; pendingLabel: string }) => {
  const { pending } = useFormStatus();
  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
};

export default function SettingsClient({ user, preferences, isAdmin }: SettingsClientProps) {
  const [profileState, profileAction] = useFormState(updateProfile, initialState);
  const [passwordState, passwordAction] = useFormState(changePassword, initialState);
  const [prefState, prefAction] = useFormState(updatePreferences, initialState);
  const [adminState, adminAction] = useFormState(adminCreateUser, initialState);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (adminState.tempPassword) {
      setTempPassword(adminState.tempPassword);
      setCopySuccess(false);
    }
  }, [adminState.tempPassword]);

  const handleCopy = async () => {
    if (!tempPassword) {
      return;
    }
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopySuccess(true);
    } catch {
      setCopySuccess(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <div className="badge">Settings</div>
          <h1>設定</h1>
          <p className="settings-subtitle">
            プロフィール、セキュリティ、表示設定を管理できます。
          </p>
        </div>
      </header>

      <section className="card settings-card">
        <div className="settings-card__header">
          <h2>プロフィール</h2>
          <p>表示名を更新します。</p>
        </div>
        <form action={profileAction} className="settings-form">
          <div className="settings-field">
            <label className="settings-label" htmlFor="displayName">
              表示名
            </label>
            <input
              className="settings-input"
              id="displayName"
              name="displayName"
              defaultValue={user.displayName}
              required
            />
            {profileState.fieldErrors?.displayName ? (
              <p className="settings-error" role="alert">
                {profileState.fieldErrors.displayName}
              </p>
            ) : null}
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="email">
              メールアドレス
            </label>
            <input
              className="settings-input"
              id="email"
              name="email"
              value={user.email}
              disabled
              readOnly
            />
          </div>
          {profileState.error ? (
            <p className="settings-error" role="alert">
              {profileState.error}
            </p>
          ) : null}
          {profileState.ok ? (
            <p className="settings-success" role="status">
              プロフィールを更新しました。
            </p>
          ) : null}
          <div className="settings-actions">
            <SubmitButton label="更新する" pendingLabel="更新中…" />
          </div>
        </form>
      </section>

      <section className="card settings-card">
        <div className="settings-card__header">
          <h2>セキュリティ</h2>
          <p>パスワードを変更します。</p>
        </div>
        <form action={passwordAction} className="settings-form">
          <div className="settings-field">
            <label className="settings-label" htmlFor="currentPassword">
              現在のパスワード
            </label>
            <input
              className="settings-input"
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
            {passwordState.fieldErrors?.currentPassword ? (
              <p className="settings-error" role="alert">
                {passwordState.fieldErrors.currentPassword}
              </p>
            ) : null}
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="newPassword">
              新しいパスワード
            </label>
            <input
              className="settings-input"
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
            {passwordState.fieldErrors?.newPassword ? (
              <p className="settings-error" role="alert">
                {passwordState.fieldErrors.newPassword}
              </p>
            ) : null}
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="confirmPassword">
              新しいパスワード（確認）
            </label>
            <input
              className="settings-input"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
            {passwordState.fieldErrors?.confirmPassword ? (
              <p className="settings-error" role="alert">
                {passwordState.fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>
          {passwordState.error ? (
            <p className="settings-error" role="alert">
              {passwordState.error}
            </p>
          ) : null}
          {passwordState.ok ? (
            <p className="settings-success" role="status">
              パスワードを更新しました。
            </p>
          ) : null}
          <div className="settings-actions">
            <SubmitButton label="変更する" pendingLabel="更新中…" />
          </div>
        </form>
      </section>

      <section className="card settings-card">
        <div className="settings-card__header">
          <h2>表示・入力設定</h2>
          <p>メモの使い勝手を調整します。</p>
        </div>
        <form action={prefAction} className="settings-form">
          <div className="settings-field settings-checkbox">
            <label className="settings-checkbox__label">
              <input
                className="settings-checkbox__input"
                type="checkbox"
                name="compactMode"
                defaultChecked={preferences.ui.compactMode}
              />
              余白を詰めてコンパクトに表示する
            </label>
          </div>
          <div className="settings-field settings-checkbox">
            <label className="settings-checkbox__label">
              <input
                className="settings-checkbox__input"
                type="checkbox"
                name="reduceMotion"
                defaultChecked={preferences.ui.reduceMotion}
              />
              アニメーションを減らす
            </label>
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="defaultBlockType">
              新規メモのブロックタイプ
            </label>
            <select
              className="settings-select"
              id="defaultBlockType"
              name="defaultBlockType"
              defaultValue={preferences.editor.defaultBlockType}
            >
              <option value="paragraph">段落</option>
              <option value="todo">ToDo</option>
            </select>
          </div>
          {prefState.error ? (
            <p className="settings-error" role="alert">
              {prefState.error}
            </p>
          ) : null}
          {prefState.ok ? (
            <p className="settings-success" role="status">
              設定を保存しました。
            </p>
          ) : null}
          <div className="settings-actions">
            <SubmitButton label="保存する" pendingLabel="保存中…" />
          </div>
        </form>
      </section>

      {isAdmin ? (
        <section className="card settings-card">
          <div className="settings-card__header">
            <h2>ユーザー管理</h2>
            <p>管理者のみ新規アカウントを発行できます。</p>
          </div>
          <form action={adminAction} className="settings-form">
            <div className="settings-field">
              <label className="settings-label" htmlFor="adminEmail">
                メールアドレス
              </label>
              <input
                className="settings-input"
                id="adminEmail"
                name="email"
                type="email"
                placeholder="new-user@example.com"
                required
              />
              {adminState.fieldErrors?.email ? (
                <p className="settings-error" role="alert">
                  {adminState.fieldErrors.email}
                </p>
              ) : null}
            </div>
            <div className="settings-field">
              <label className="settings-label" htmlFor="adminName">
                表示名（任意）
              </label>
              <input
                className="settings-input"
                id="adminName"
                name="name"
                placeholder="新規ユーザー"
              />
              {adminState.fieldErrors?.name ? (
                <p className="settings-error" role="alert">
                  {adminState.fieldErrors.name}
                </p>
              ) : null}
            </div>
            <div className="settings-field">
              <label className="settings-checkbox__label">
                <input
                  className="settings-checkbox__input"
                  type="checkbox"
                  name="isAdmin"
                />
                管理者として発行する
              </label>
            </div>
            {adminState.error ? (
              <p className="settings-error" role="alert">
                {adminState.error}
              </p>
            ) : null}
            {adminState.ok ? (
              <p className="settings-success" role="status">
                アカウントを発行しました。
              </p>
            ) : null}
            <div className="settings-actions">
              <SubmitButton label="アカウント発行" pendingLabel="発行中…" />
            </div>
          </form>
          {tempPassword ? (
            <div className="settings-temp">
              <div className="settings-temp__header">一時パスワード</div>
              <p className="settings-temp__note">
                この画面を閉じると再表示できません。必ず控えてください。
              </p>
              <div className="settings-temp__row">
                <input
                  className="settings-input"
                  value={tempPassword}
                  readOnly
                  aria-label="一時パスワード"
                />
                <button className="button button--ghost" type="button" onClick={handleCopy}>
                  {copySuccess ? 'コピー済み' : 'コピー'}
                </button>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => setTempPassword(null)}
                >
                  非表示
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
