import { create } from 'zustand';
import { Product, Category } from '../types';

interface CartItem extends Product {
  quantity: number;
}

interface StoreState {
  // Cart pour la caisse
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  updateCartQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;

  // Produits
  products: Product[];
  setProducts: (products: Product[]) => void;

  // Catégories
  categories: Category[];
  setCategories: (categories: Category[]) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  // État initial
  cart: [],
  products: [],
  categories: [],

  // Actions cart
  addToCart: (product) => {
    const { cart } = get();
    const existingItem = cart.find((item) => item.id === product.id);

    if (existingItem) {
      set({
        cart: cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      });
    } else {
      set({
        cart: [...cart, { ...product, quantity: 1 }],
      });
    }
  },

  removeFromCart: (productId) => {
    set({
      cart: get().cart.filter((item) => item.id !== productId),
    });
  },

  updateCartQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }

    set({
      cart: get().cart.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      ),
    });
  },

  clearCart: () => {
    set({ cart: [] });
  },

  getCartTotal: () => {
    return get().cart.reduce(
      (total, item) => total + item.prix_vente * item.quantity,
      0
    );
  },

  // Actions produits
  setProducts: (products) => set({ products }),

  // Actions catégories
  setCategories: (categories) => set({ categories }),
}));
