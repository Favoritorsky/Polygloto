import { createContext } from 'react';

/**
 * {
 *   user:        firebase.User | null
 *   profile:     users/{uid} | null (null, пока клиент его создаёт)
 *   initializing: bool — ещё не известно, вошёл ли пользователь
 *   profileLoading, profileError
 *   isVerified:  email подтверждён (из Firebase Auth, не из базы)
 *   isAdmin, isBanned
 * }
 */
export const AuthContext = createContext(null);
