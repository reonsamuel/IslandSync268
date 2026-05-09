import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  query,
  orderBy,
  collectionGroup,
  where
} from 'firebase/firestore';
import { Driver, User, UserRole, CargoItem, DeliveryStatus } from '../types';
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';

interface LogisticsContextType {
  user: User | null;
  drivers: Driver[];
  isAuthLoading: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  signUp: (email?: string, password?: string, name?: string) => Promise<void>;
  logout: () => void;
  setRole: (role: UserRole) => Promise<void>;
  // Driver Actions
  updateLocation: (lat: number, lng: number) => Promise<void>;
  toggleStatus: (isOnline: boolean) => Promise<void>;
  updateCargo: (cargo: CargoItem[]) => Promise<void>;
  updateDeliveryStatus: (status: DeliveryStatus, proofOfDelivery?: string, signature?: string) => Promise<void>;
  deliverItem: (itemId: string, proofOfDelivery?: string, signature?: string) => Promise<void>;
}

const LogisticsContext = createContext<LogisticsContextType | undefined>(undefined);

export const LogisticsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [rawDrivers, setRawDrivers] = useState<Record<string, any>>({});
  const [cargoData, setCargoData] = useState<Record<string, CargoItem[]>>({});
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Derived drivers state
  const drivers: Driver[] = React.useMemo(() => {
    return Object.entries(rawDrivers).map(([id, data]) => ({
      id,
      ...data,
      cargo: cargoData[id] || []
    })) as Driver[];
  }, [rawDrivers, cargoData]);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({
              id: firebaseUser.uid,
              role: data.role as UserRole,
              name: data.name || firebaseUser.displayName || 'User'
            });
          } else {
            setUser({ id: firebaseUser.uid, role: UserRole.NONE, name: firebaseUser.displayName || 'User' });
          }
        } catch (error) {
          setUser({ id: firebaseUser.uid, role: UserRole.NONE, name: firebaseUser.displayName || 'User' });
        }
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Drivers & Cargo Listeners
  useEffect(() => {
    if (!user) {
      setRawDrivers({});
      setCargoData({});
      return;
    }

    // 2a. Drivers Listener
    const driversRef = collection(db, 'drivers');
    const unsubscribeDrivers = onSnapshot(driversRef, (snapshot) => {
      setRawDrivers(prev => {
        const newDrivers = { ...prev };
        snapshot.docs.forEach(doc => {
          newDrivers[doc.id] = doc.data();
        });
        // Remove deleted drivers
        const activeIds = new Set(snapshot.docs.map(d => d.id));
        Object.keys(newDrivers).forEach(id => {
          if (!activeIds.has(id)) delete newDrivers[id];
        });
        return newDrivers;
      });
    }, (error) => {
      if (!error.message.includes('insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'drivers');
      }
    });

    // 2b. Global Cargo Listener (Collection Group)
    const cargoQuery = query(collectionGroup(db, 'cargo'));
    const unsubscribeCargo = onSnapshot(cargoQuery, (snapshot) => {
      const newCargoData: Record<string, CargoItem[]> = {};
      
      snapshot.docs.forEach(doc => {
        const item = { id: doc.id, ...doc.data() } as CargoItem;
        const driverId = doc.ref.parent.parent?.id;
        if (driverId) {
          if (!newCargoData[driverId]) newCargoData[driverId] = [];
          newCargoData[driverId].push(item);
        }
      });

      setCargoData(newCargoData);
    }, (error) => {
      console.warn("Cargo collection group listener failed.", error);
    });

    return () => {
      unsubscribeDrivers();
      unsubscribeCargo();
    };
  }, [user]);

  // 4. Removed the redundant single-driver cargo sync as the collectionGroup handles it

  const login = async (username?: string, password?: string) => {
    if (!username || !password) return;
    try {
      // Append a domain to treat username as email for Firebase
      const email = `${username.toLowerCase()}@islandsync.app`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const signUp = async (username?: string, password?: string, name?: string) => {
    if (!username || !password || !name) return;
    try {
      const email = `${username.toLowerCase()}@islandsync.app`;
      const result = await createUserWithEmailAndPassword(auth, email, password);
      // Immediately create a profile in Firestore and update local state
      if (result.user) {
        await setDoc(doc(db, 'users', result.user.uid), {
          name: name,
          role: UserRole.NONE,
          username: username.toLowerCase()
        });

        setUser({
          id: result.user.uid,
          role: UserRole.NONE,
          name: name
        });
      }
    } catch (error) {
      console.error("Sign up failed:", error);
      throw error;
    }
  };

  const setRole = async (role: UserRole) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.id);
    try {
      await setDoc(userDocRef, { role, name: user.name }, { merge: true });
      setUser({ ...user, role });

      // If becoming a driver, ensure driver doc exists
      if (role === UserRole.DRIVER) {
        const driverDocRef = doc(db, 'drivers', user.id);
        const driverDoc = await getDoc(driverDocRef);
        if (!driverDoc.exists()) {
          await setDoc(driverDocRef, {
            name: user.name,
            isOnline: false,
            latitude: 17.1165,
            longitude: -61.7915,
            status: 'IN_TRANSIT',
            lastUpdate: Date.now()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
    }
  };

  const logout = () => signOut(auth);

  // Driver Methods
  const updateLocation = async (lat: number, lng: number) => {
    if (user?.role !== UserRole.DRIVER) return;
    const driverDocRef = doc(db, 'drivers', user.id);
    try {
      await updateDoc(driverDocRef, { 
        latitude: lat, 
        longitude: lng, 
        lastUpdate: Date.now() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drivers/${user.id}`);
    }
  };

  const toggleStatus = async (isOnline: boolean) => {
    if (user?.role !== UserRole.DRIVER) return;
    const driverDocRef = doc(db, 'drivers', user.id);
    try {
      await updateDoc(driverDocRef, { 
        isOnline, 
        lastUpdate: Date.now() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drivers/${user.id}`);
    }
  };

  const updateCargo = async (cargo: CargoItem[]) => {
    if (user?.role !== UserRole.DRIVER) return;
    
    const cargoRef = collection(db, `drivers/${user.id}/cargo`);
    try {
      // 1. Fetch current items from Firestore to identify deletions
      const currentDriverData = drivers.find(d => d.id === user.id);
      const existingItems = currentDriverData?.cargo || [];
      
      // 2. Identify items to delete
      const incomingIds = new Set(cargo.map(c => c.id));
      const toDelete = existingItems.filter(item => !incomingIds.has(item.id));
      
      // 3. Perform deletions
      for (const item of toDelete) {
        await deleteDoc(doc(cargoRef, item.id));
      }

      // 4. Perform additions/updates
      for (const item of cargo) {
        const itemDocRef = doc(cargoRef, item.id);
        const existingItem = existingItems.find(ei => ei.id === item.id);
        
        await setDoc(itemDocRef, {
          name: item.name,
          quantity: item.quantity,
          destination: item.destination,
          merchantId: item.merchantId,
          status: item.status || existingItem?.status || 'PENDING',
          proofOfDelivery: item.proofOfDelivery || existingItem?.proofOfDelivery || null,
          signature: item.signature || existingItem?.signature || null
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `drivers/${user.id}/cargo`);
    }
  };

  const updateDeliveryStatus = async (status: DeliveryStatus, proofOfDelivery?: string, signature?: string) => {
    if (user?.role !== UserRole.DRIVER) return;
    const driverDocRef = doc(db, 'drivers', user.id);
    try {
      const updates: any = { status, lastUpdate: Date.now() };
      if (proofOfDelivery) updates.proofOfDelivery = proofOfDelivery;
      if (signature) updates.signature = signature;
      await updateDoc(driverDocRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drivers/${user.id}`);
    }
  };

  const deliverItem = async (itemId: string, proofOfDelivery?: string, signature?: string) => {
    if (user?.role !== UserRole.DRIVER) return;
    const itemDocRef = doc(db, `drivers/${user.id}/cargo`, itemId);
    try {
      const updates: any = { 
        status: 'DELIVERED',
        deliveredAt: Date.now()
      };
      if (proofOfDelivery) updates.proofOfDelivery = proofOfDelivery;
      if (signature) updates.signature = signature;
      
      await updateDoc(itemDocRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drivers/${user.id}/cargo/${itemId}`);
    }
  };

  return (
    <LogisticsContext.Provider value={{ 
      user, 
      drivers, 
      isAuthLoading,
      login, 
      signUp,
      logout, 
      setRole,
      updateLocation, 
      toggleStatus, 
      updateCargo,
      updateDeliveryStatus,
      deliverItem 
    }}>
      {children}
    </LogisticsContext.Provider>
  );
};

export const useLogistics = () => {
  const context = useContext(LogisticsContext);
  if (!context) throw new Error('useLogistics must be used within a LogisticsProvider');
  return context;
};
