import { create } from 'zustand';
import { Product, Category } from '../types';

interface CartItem extends Product {
  quantity: number;
  customPrice?: number;
}

interface EditingSale {
  vente_id: number;
  invoice_id: number;
  montant_paye: number;
  client_id?: number;
  client_nom?: string;
}

interface StoreState {
  cart: CartItem[];
  addToCart: (product: Product, customPrice?: number) => void;
  removeFromCart: (productId: number) => void;
  updateCartQuantity: (productId: number, quantity: number) => void;
  updateCartItemPrice: (productId: number, customPrice: number) => void;
  updateAllCartPrices: (prices: Map<number, number>) => void;
  clearCart: () => void;
  getCartTotal: () => number;

  editingSale: EditingSale | null;
  setEditingSale: (data: EditingSale) => void;
  clearEditingSale: () => void;

  products: Product[];
  setProducts: (products: Product[]) => void;

  categories: Category[];
  setCategories: (categories: Category[]) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  cart: [],
  products: [],
  categories: [],
  editingSale: null,

  setEditingSale: (data) => set({ editingSale: data }),
  clearEditingSale: () => set({ editingSale: null }),

  addToCart: (product, customPrice) => {
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
        cart: [...cart, { ...product, quantity: 1, customPrice }],
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

  updateCartItemPrice: (productId, customPrice) => {
    set({
      cart: get().cart.map((item) =>
        item.id === productId ? { ...item, customPrice } : item
      ),
    });
  },

  updateAllCartPrices: (prices) => {
    set({
      cart: get().cart.map((item) => {
        const customPrice = prices.get(item.id!);
        return customPrice !== undefined
          ? { ...item, customPrice }
          : { ...item, customPrice: undefined };
      }),
    });
  },

  clearCart: () => {
    set({ cart: [] });
  },

  getCartTotal: () => {
    return get().cart.reduce(
      (total, item) => {
        const price = item.customPrice !== undefined ? item.customPrice : item.prix_vente;
        return total + price * item.quantity;
      },
      0
    );
  },

  setProducts: (products) => set({ products }),

  setCategories: (categories) => set({ categories }),
}));
