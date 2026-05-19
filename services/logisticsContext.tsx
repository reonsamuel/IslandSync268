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
  where,
  limit,
  addDoc
} from 'firebase/firestore';
import { Driver, User, UserRole, CargoItem, DeliveryStatus, ChatMessage, Conversation } from '../types';
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from './firebase';
import { MERCHANTS } from './mockData';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';

interface Merchant {
  id: string;
  name: string;
  sector: string;
  latitude: number;
  longitude: number;
}

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
  // Merchant Admin Actions
  merchantUpdateDriver: (driverId: string, updates: Partial<Driver>) => Promise<void>;
  addMerchant: (merchant: Omit<Merchant, 'id'>) => Promise<void>;
  updateMerchant: (merchantId: string, updates: Partial<Merchant>) => Promise<void>;
  deleteMerchant: (merchantId: string) => Promise<void>;
  merchants: Merchant[];
  // Chat Actions
  setActiveChatId: (chatId: string | null) => void;
  activeChatId: string | null;
  setIsChatOpen: (isOpen: boolean) => void;
  isChatOpen: boolean;
  conversations: Conversation[];
  sendMessage: (text: string, chatId?: string) => Promise<void>;
  markAsRead: (chatId: string) => Promise<void>;
  messages: ChatMessage[];
}

const LogisticsContext = createContext<LogisticsContextType | undefined>(undefined);

export const LogisticsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>(MERCHANTS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [rawDrivers, setRawDrivers] = useState<Record<string, any>>({});
  const [cargoData, setCargoData] = useState<Record<string, CargoItem[]>>({});
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Derived drivers state
  const drivers: Driver[] = React.useMemo(() => {
    const allDrivers = { ...rawDrivers };
    // Ensure current user is included if they are a driver, even if the server listener hasn't picked them up
    if (user && user.role === UserRole.DRIVER && !allDrivers[user.id]) {
      allDrivers[user.id] = {
        name: user.name,
        isOnline: false,
        latitude: 17.1165,
        longitude: -61.7915,
        status: 'OFFLINE',
        lastUpdate: Date.now()
      };
    }
    
    return Object.entries(allDrivers).map(([id, data]) => ({
      id,
      ...data,
      avatar: (data as any).avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
      cargo: (cargoData[id] || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    })) as Driver[];
  }, [rawDrivers, cargoData, user]);

  // Set default activeChatId for drivers
  useEffect(() => {
    if (user?.role === UserRole.DRIVER) {
      setActiveChatId(user.id);
    }
  }, [user]);

  // Clear unread status when activeChatId or chat state changes
  useEffect(() => {
    if (user && activeChatId && isChatOpen) {
      markAsRead(activeChatId);
    }
  }, [user, activeChatId, isChatOpen]);

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
              name: data.name || firebaseUser.displayName || 'User',
              avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`
            });
          } else {
            setUser({ id: firebaseUser.uid, role: UserRole.NONE, name: firebaseUser.displayName || 'User', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}` });
          }
        } catch (error) {
          setUser({ id: firebaseUser.uid, role: UserRole.NONE, name: firebaseUser.displayName || 'User', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}` });
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

    const unsubscribers: (() => void)[] = [];

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
    unsubscribers.push(unsubscribeDrivers);

    // 2b. Merchants Listener
    const merchantsRef = collection(db, 'merchants');
    const unsubscribeMerchants = onSnapshot(merchantsRef, (snapshot) => {
      const firestoreMerchants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Merchant));
      
      // Merge with initial data and deduplicate by name
      // Preferring Firestore data if names match, but ensuring coordinates exist
      const merchantMap = new Map<string, Merchant>();
      
      // Add defaults first
      MERCHANTS.forEach(m => merchantMap.set(m.name.toLowerCase(), m));
      
      // Overwrite with Firestore data, but only if they have sane coordinates OR we already have coordinates
      firestoreMerchants.forEach(fm => {
        const key = fm.name.toLowerCase();
        const existing = merchantMap.get(key);
        
        const hasValidCoords = (m: Merchant) => 
          typeof m.latitude === 'number' && typeof m.longitude === 'number' && 
          !isNaN(m.latitude) && !isNaN(m.longitude) && 
          m.latitude !== 0 && m.longitude !== 0;

        if (hasValidCoords(fm)) {
          merchantMap.set(key, fm);
        } else if (existing && hasValidCoords(existing)) {
          // If Firestore one is missing coords but we have a default with coords, keep default name/sector if they match? 
          // Actually, just merge them: use Firestore ID and metadata but keep coordinates
          merchantMap.set(key, { ...fm, latitude: existing.latitude, longitude: existing.longitude });
        } else {
          // Both missing coords? Just use Firestore one
          merchantMap.set(key, fm);
        }
      });
      
      const sortedMerchants = Array.from(merchantMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      setMerchants(sortedMerchants);
    }, (error) => {
      if (!error.message.includes('insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, 'merchants');
      }
    });
    unsubscribers.push(unsubscribeMerchants);

    // 2c. Cargo Listeners
    if (user.role === UserRole.MERCHANT) {
      // Merchants listen to everything via Collection Group
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
      unsubscribers.push(unsubscribeCargo);
    } else if (user.role === UserRole.DRIVER) {
      // Drivers only listen to their OWN cargo - much more reliable and faster
      const myCargoRef = collection(db, `drivers/${user.id}/cargo`);
      const unsubscribeMyCargo = onSnapshot(myCargoRef, (snapshot) => {
        const myItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CargoItem));
        setCargoData(prev => ({
          ...prev,
          [user.id]: myItems
        }));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `drivers/${user.id}/cargo`);
      });
      unsubscribers.push(unsubscribeMyCargo);
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }, [user]);

  // 2d. Chat Messages Listener - Dynamic based on activeChatId
  useEffect(() => {
    if (!user || !activeChatId) {
      setMessages([]);
      return;
    }

    const messagesRef = collection(db, `chats/${activeChatId}/messages`);
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(200));
    
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)).reverse();
      setMessages(msgs);
    }, (error) => {
      // Avoid spamming error if permissions aren't set up yet or if it's a new chat
      if (!error.message.includes('insufficient permissions')) {
        console.warn("Messages listener failed:", error);
      }
    });

    return () => unsubscribeMessages();
  }, [user, activeChatId]);

  // 2e. Conversations Listener (Master list for Merchants)
  useEffect(() => {
    if (!user || user.role !== UserRole.MERCHANT) {
      setConversations([]);
      return;
    }

    const conversationsRef = collection(db, 'conversations');
    const conversationsQuery = query(conversationsRef, orderBy('lastTimestamp', 'desc'));

    const unsubscribeConversations = onSnapshot(conversationsQuery, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ chatId: doc.id, ...doc.data() } as Conversation));
      setConversations(convs);
    }, (error) => {
      if (!error.message.includes('insufficient permissions')) {
        console.warn("Conversations listener failed:", error);
      }
    });

    return () => unsubscribeConversations();
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
            avatar: user.avatar,
            isOnline: false,
            latitude: 17.1165,
            longitude: -61.7915,
            status: 'IN_TRANSIT',
            lastUpdate: Date.now()
          });
        } else {
          await updateDoc(driverDocRef, { avatar: user.avatar });
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
        
        const data: any = {
          name: item.name,
          quantity: item.quantity,
          destination: item.destination,
          merchantId: item.merchantId,
          status: item.status || existingItem?.status || 'PENDING',
          createdAt: item.createdAt || existingItem?.createdAt || Date.now()
        };

        if (item.proofOfDelivery || existingItem?.proofOfDelivery) {
          data.proofOfDelivery = item.proofOfDelivery || existingItem?.proofOfDelivery;
        }
        if (item.signature || existingItem?.signature) {
          data.signature = item.signature || existingItem?.signature;
        }
        if (item.deliveredAt || existingItem?.deliveredAt) {
          data.deliveredAt = item.deliveredAt || existingItem?.deliveredAt;
        }

        await setDoc(itemDocRef, data);
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

  const merchantUpdateDriver = async (driverId: string, updates: Partial<Driver>) => {
    if (user?.role !== UserRole.MERCHANT) return;
    const driverDocRef = doc(db, 'drivers', driverId);
    try {
      await updateDoc(driverDocRef, {
        ...updates,
        lastUpdate: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drivers/${driverId}`);
    }
  };

  const addMerchant = async (merchant: Omit<Merchant, 'id'>) => {
    if (user?.role !== UserRole.MERCHANT) return;
    const merchantsRef = collection(db, 'merchants');
    try {
      await setDoc(doc(merchantsRef), merchant);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'merchants');
    }
  };

  const updateMerchant = async (merchantId: string, updates: Partial<Merchant>) => {
    if (user?.role !== UserRole.MERCHANT) return;
    const merchantDocRef = doc(db, 'merchants', merchantId);
    try {
      await updateDoc(merchantDocRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `merchants/${merchantId}`);
    }
  };

  const deleteMerchant = async (merchantId: string) => {
    if (user?.role !== UserRole.MERCHANT) return;
    const merchantDocRef = doc(db, 'merchants', merchantId);
    try {
      await deleteDoc(merchantDocRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `merchants/${merchantId}`);
    }
  };

  const sendMessage = async (text: string, chatId?: string) => {
    if (!user || user.role === UserRole.NONE) return;
    
    // Fallback to activeChatId or user.id for drivers
    const targetChatId = chatId || activeChatId || (user.role === UserRole.DRIVER ? user.id : null);
    
    if (!targetChatId) {
      console.warn("No active chat ID or recipient provided.");
      return;
    }

    const messagesRef = collection(db, `chats/${targetChatId}/messages`);
    const conversationRef = doc(db, 'conversations', targetChatId);

    try {
      const timestamp = Date.now();
      
      // 1. Add Message
      await addDoc(messagesRef, {
        chatId: targetChatId,
        senderId: user.id,
        senderName: user.name,
        senderAvatar: user.avatar,
        text,
        timestamp,
        role: user.role
      });

      // 2. Update Conversation Summary for real-time list sync
      const unreadUpdates: any = {
        lastMessage: text,
        lastTimestamp: timestamp,
        lastSenderName: user.name,
        lastSenderId: user.id
      };
      
      if (user.role === UserRole.DRIVER) {
        unreadUpdates.unreadMerchant = true;
      } else if (user.role === UserRole.MERCHANT) {
        unreadUpdates.unreadDriver = true;
      }

      await setDoc(conversationRef, unreadUpdates, { merge: true });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${targetChatId}/messages`);
    }
  };

  const markAsRead = async (chatId: string) => {
    if (!user) return;
    const conversationRef = doc(db, 'conversations', chatId);
    try {
      const update: any = {};
      if (user.role === UserRole.MERCHANT) {
        update.unreadMerchant = false;
      } else if (user.role === UserRole.DRIVER) {
        update.unreadDriver = false;
      }
      // Check if document exists first before trying to update specific field
      const snap = await getDoc(conversationRef);
      if (snap.exists()) {
        await updateDoc(conversationRef, update);
      }
    } catch (error) {
      console.warn("Could not mark as read", error);
    }
  };

  return (
    <LogisticsContext.Provider value={{ 
      user, 
      drivers, 
      merchants,
      messages,
      activeChatId,
      setActiveChatId,
      isChatOpen,
      setIsChatOpen,
      conversations,
      isAuthLoading,
      login, 
      signUp,
      logout, 
      setRole,
      updateLocation, 
      toggleStatus, 
      updateCargo,
      updateDeliveryStatus,
      deliverItem,
      merchantUpdateDriver,
      addMerchant,
      updateMerchant,
      deleteMerchant,
      sendMessage,
      markAsRead
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
