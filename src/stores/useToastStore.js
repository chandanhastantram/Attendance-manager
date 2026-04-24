import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, duration);
  }
}));

export default useToastStore;
