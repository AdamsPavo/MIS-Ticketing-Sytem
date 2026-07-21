import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Prevents duplicate profile requests for the same user.
  const profileCacheRef = useRef({
    uid: null,
    profile: null,
    request: null,
  });

  const clearProfileCache = useCallback(() => {
    profileCacheRef.current = {
      uid: null,
      profile: null,
      request: null,
    };
  }, []);

  const loadUserProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      clearProfileCache();
      return null;
    }

    const cached = profileCacheRef.current;

    // Return the profile if it was already loaded.
    if (
      cached.uid === firebaseUser.uid &&
      cached.profile
    ) {
      setUserProfile(cached.profile);
      return cached.profile;
    }

    // Reuse the same request if Firestore is already loading it.
    if (
      cached.uid === firebaseUser.uid &&
      cached.request
    ) {
      const profile = await cached.request;
      setUserProfile(profile);
      return profile;
    }

    const profileRequest = (async () => {
      const userReference = doc(
        db,
        "users",
        firebaseUser.uid
      );

      const userSnapshot = await getDoc(userReference);

      if (!userSnapshot.exists()) {
        throw new Error(
          "Your account exists, but your Firestore user profile is missing."
        );
      }

      const profile = {
        id: userSnapshot.id,
        uid: firebaseUser.uid,
        ...userSnapshot.data(),
      };

      if (profile.status !== "active") {
        throw new Error(
          "Your account is currently inactive. Please contact the MIS administrator."
        );
      }

      profileCacheRef.current = {
        uid: firebaseUser.uid,
        profile,
        request: null,
      };

      return profile;
    })();

    profileCacheRef.current = {
      uid: firebaseUser.uid,
      profile: null,
      request: profileRequest,
    };

    try {
      const profile = await profileRequest;
      setUserProfile(profile);
      return profile;
    } catch (error) {
      clearProfileCache();
      setUserProfile(null);
      throw error;
    }
  }, [clearProfileCache]);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!active) {
          return;
        }

        try {
          setCurrentUser(firebaseUser);

          if (!firebaseUser) {
            setUserProfile(null);
            clearProfileCache();
            return;
          }

          await loadUserProfile(firebaseUser);
        } catch (error) {
          console.error(
            "Unable to load user profile:",
            error
          );

          if (active) {
            setCurrentUser(null);
            setUserProfile(null);
            clearProfileCache();
          }

          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error(
              "Unable to sign out invalid account:",
              signOutError
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [clearProfileCache, loadUserProfile]);

  const login = useCallback(
    async (email, password) => {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      try {
        /*
         * The authentication observer may also request this profile.
         * loadUserProfile reuses the same Firestore request, so it is
         * not downloaded twice.
         */
        const profile = await loadUserProfile(
          credential.user
        );

        setCurrentUser(credential.user);

        return {
          user: credential.user,
          profile,
        };
      } catch (error) {
        clearProfileCache();
        setCurrentUser(null);
        setUserProfile(null);

        await signOut(auth);

        throw error;
      }
    },
    [clearProfileCache, loadUserProfile]
  );

  const logout = useCallback(async () => {
    clearProfileCache();
    setCurrentUser(null);
    setUserProfile(null);

    await signOut(auth);
  }, [clearProfileCache]);

  const value = useMemo(
    () => ({
      currentUser,
      userProfile,
      loading,
      login,
      logout,
      reloadUserProfile: () => {
        clearProfileCache();

        if (!auth.currentUser) {
          return Promise.resolve(null);
        }

        return loadUserProfile(auth.currentUser);
      },
    }),
    [
      currentUser,
      userProfile,
      loading,
      login,
      logout,
      clearProfileCache,
      loadUserProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}