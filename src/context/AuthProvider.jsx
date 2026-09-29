import { useEffect, useMemo, useRef, useState } from 'react';
import { ROLES } from '../../shared/schema.js';
import { subscribeToAuth, syncRole } from '../services/authService.js';
import { createOwnProfile, isProfileBeingCreated, subscribeToUser } from '../services/userService.js';
import { AuthContext } from './authContext.js';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [profileState, setProfileState] = useState({ uid: null, profile: null, error: null });
  // Номер «версии» токена: меняется после reload/getIdToken(true), чтобы
  // потребители увидели обновлённый emailVerified.
  const [tokenVersion, setTokenVersion] = useState(0);
  const syncRequested = useRef(null);

  useEffect(
    () =>
      subscribeToAuth((nextUser) => {
        setUser(nextUser);
        setTokenVersion((v) => v + 1);
        setInitializing(false);
      }),
    [],
  );

  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToUser(
      uid,
      (profile) => setProfileState({ uid, profile, error: null }),
      (error) => setProfileState({ uid, profile: null, error }),
    );
  }, [uid]);

  // Профиль, относящийся к другому (прошлому) пользователю, не показываем.
  const profile = profileState.uid === uid ? profileState.profile : null;
  const profileError = profileState.uid === uid ? profileState.error : null;
  const profileLoading = Boolean(uid) && profileState.uid !== uid;
  const isVerified = Boolean(user?.emailVerified);

  // Профиля нет (регистрация прервалась до его записи) — создаём с именем по умолчанию.
  const profileMissing = Boolean(uid) && profileState.uid === uid && profileState.profile === null && !profileState.error;
  const creationRequested = useRef(null);
  useEffect(() => {
    if (!profileMissing || isProfileBeingCreated(uid) || creationRequested.current === uid) return;
    creationRequested.current = uid;
    createOwnProfile(uid).catch(() => {
      creationRequested.current = null;
    });
  }, [uid, profileMissing]);

  // Почта подтверждена, а роль ещё reader — повышаем (один раз на uid).
  useEffect(() => {
    if (!uid || !isVerified || profile?.role !== ROLES.READER) return;
    if (syncRequested.current === uid) return;
    syncRequested.current = uid;
    syncRole().catch(() => {
      syncRequested.current = null;
    });
  }, [uid, isVerified, profile?.role]);

  const value = useMemo(
    () => ({
      user,
      profile,
      initializing,
      profileLoading,
      profileError,
      isVerified,
      isAdmin: profile?.role === ROLES.ADMIN,
      isBanned: profile?.banned === true,
      tokenVersion,
    }),
    [user, profile, initializing, profileLoading, profileError, isVerified, tokenVersion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
