"use client";

import { createContext, useContext } from "react";

interface User {
  id: string;
  email?: string;
  name?: string;
  username?: string;
}

const UserContext = createContext<User | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext);
}
