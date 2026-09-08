import { useEffect, useState } from 'react';
import { Wallet, PieChart, Plus, X, Trash2 } from 'lucide-react';
import axios from 'axios';

interface Category {
    id: string;
    name: string;
    icon: string;
}

interface Transaction {
    id: string;
    amount: number;
    currency: string;
    date: string;
    categoryId: string;
    comment: string;
    category: Category;
}

function App() {
    // Получение пользователя из Telegram WebApp с безопасным кастом
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id ? String(tgUser.id) : '';

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Стейт для модалки редактирования/добавления
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [formData, setFormData] = useState({ amount: '', categoryId: '', comment: '', currency: 'USD' });

    const rawUrl = (import.meta as any).env?.VITE_API_URL || 'https://coinflow-bot.onrender.com/api';
    const API_BASE_URL = rawUrl.replace(/\/+$/, '');

    // Обратная связь TWA
    const triggerHaptic = (type: 'success' | 'error' | 'warning') => {
        const haptic = (window as any).Telegram?.WebApp?.HapticFeedback;
        if (haptic) haptic.notificationOccurred(type);
    };

    useEffect(() => {
        const loadInitialData = async () => {
            if (!userId) setLoading(false);
            try {
                // Грузим категории
                const catsRes = await axios.get(`${API_BASE_URL}/categories?userId=${userId}`);
                setCategories(catsRes.data);

                // Грузим транзакции
                if (userId) {
                    const txRes = await axios.get(`${API_BASE_URL}/transactions/${userId}`);
                    setTransactions(txRes.data);
                }
            } catch (err) {
                console.error("Data load error:", err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [userId, API_BASE_URL]);

    const handleOpenModal = (tx: Transaction | null = null) => {
        if (tx) {
            setEditingTx(tx);
            setFormData({ amount: tx.amount.toString(), categoryId: tx.category?.id || '', comment: tx.comment || '', currency: tx.currency || 'USD' });
        } else {
            setEditingTx(null);
            setFormData({ amount: '', categoryId: categories[0]?.id || '', comment: '', currency: 'USD' });
        }
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.amount || !formData.categoryId) return;

        try {
            if (editingTx) {
                // Обновление
                const res = await axios.put(`${API_BASE_URL}/transactions/${editingTx.id}`, formData);
                setTransactions(prev => prev.map(t => t.id === editingTx.id ? res.data : t));
            } else {
                // Создание
                if (!userId) return alert('Демо-режим: сохранение невозможно');
                const res = await axios.post(`${API_BASE_URL}/transactions`, {
                    ...formData,
                    userId,
                    date: new Date().toISOString()
                });
                setTransactions(prev => [res.data, ...prev]);
            }
            triggerHaptic('success');
            setModalOpen(false);
        } catch (err) {
            console.error(err);
            triggerHaptic('error');
            alert('Ошибка сервера при сохранении');
        }
    };

    const handleDelete = async () => {
        if (!editingTx) return;
        if (!confirm('Точно удалить эту трату?')) return;

        try {
            await axios.delete(`${API_BASE_URL}/transactions/${editingTx.id}`);
            setTransactions(prev => prev.filter(t => t.id !== editingTx.id));
            triggerHaptic('success');
            setModalOpen(false);
        } catch (err) {
            console.error(err);
            triggerHaptic('error');
            alert('Ошибка при удалении');
        }
    };

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const displayAmount = totalAmount.toLocaleString('ru-RU');

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="min-h-screen bg-[var(--tg-theme-secondary-bg-color,#f3f4f6)] p-5 flex flex-col gap-6 font-sans relative pb-24">

            <header className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-[var(--tg-theme-text-color,#111827)] text-2xl font-bold tracking-tight">
                        Мои финансы
                    </h1>
                    <p className="text-[var(--tg-theme-hint-color,#6b7280)] text-sm mt-0.5">
                        {tgUser?.first_name ? `Привет, ${tgUser.first_name}!` : 'Демо-режим'}
                    </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-tr from-[var(--tg-theme-button-color,#3b82f6)] to-[var(--tg-theme-button-color,#2563eb)] text-[var(--tg-theme-button-text-color,#ffffff)] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Wallet size={24} />
                </div>
            </header>

            <div className="bg-[var(--tg-theme-bg-color,#ffffff)] rounded-[24px] p-6 shadow-sm border border-[var(--tg-theme-hint-color,#e5e7eb)]/40 transition-all hover:shadow-md">
                <h2 className="text-[var(--tg-theme-hint-color,#6b7280)] text-sm font-medium mb-1">Траты в этом месяце</h2>
                <div className="text-4xl font-extrabold text-[var(--tg-theme-text-color,#111827)] mb-5 tracking-tight">
                    {displayAmount} {transactions[0]?.currency || 'USD'}
                </div>

                <div className="h-28 bg-[var(--tg-theme-secondary-bg-color,#f8fafc)] rounded-2xl flex flex-col items-center justify-center text-[var(--tg-theme-hint-color,#94a3b8)] gap-2 border border-dashed border-[var(--tg-theme-hint-color,#cbd5e1)]/60">
                    <PieChart size={28} className="text-[var(--tg-theme-button-color,#3b82f6)] opacity-70" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-[var(--tg-theme-hint-color,#94a3b8)]">График в разработке</span>
                </div>
            </div>

            <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[var(--tg-theme-text-color,#111827)] font-bold text-xl">История</h3>
                </div>

                <div className="flex flex-col gap-3">
                    {loading ? (
                        <div className="text-center text-[var(--tg-theme-hint-color,#888)] py-4">Загрузка...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center text-[var(--tg-theme-hint-color,#888)] py-4">У вас пока нет трат.</div>
                    ) : (
                        transactions.map((tx) => (
                            <div
                                key={tx.id}
                                onClick={() => handleOpenModal(tx)}
                                className="cursor-pointer bg-[var(--tg-theme-bg-color,#ffffff)] rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-transparent active:border-[var(--tg-theme-button-color,#3b82f6)] active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-[16px] bg-[var(--tg-theme-secondary-bg-color,#f3f4f6)] flex items-center justify-center text-xl shadow-inner">
                                        {tx.category?.icon || '🏷️'}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-[var(--tg-theme-text-color,#111827)] text-base">{tx.category?.name || 'Без категории'}</span>
                                        <span className="text-[13px] text-[var(--tg-theme-hint-color,#6b7280)] font-medium max-w-[120px] truncate">
                                            {tx.comment || formatDate(tx.date)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="font-extrabold text-[17px] text-[var(--tg-theme-text-color,#111827)]">
                                        -{tx.amount} {tx.currency}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Футер */}
            <footer className="mt-auto pt-10 pb-4">
                <p className="text-xs font-semibold text-[var(--tg-theme-hint-color,#9ca3af)] text-center tracking-wide opacity-70">
                    CoinFlow v1.0 • 2026
                </p>
            </footer>

            {/* Плавающая кнопка добавить (FAB) */}
            <button
                onClick={() => handleOpenModal()}
                className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--tg-theme-button-color,#3b82f6)] text-[var(--tg-theme-button-text-color,#ffffff)] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-95 transition-transform"
            >
                <Plus size={28} className="stroke-[3]" />
            </button>

            {/* Модальное окно */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
                    <div className="bg-[var(--tg-theme-bg-color,#ffffff)] w-full max-w-md rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-[slideUp_0.3s_ease-out]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[var(--tg-theme-text-color,#111827)] whitespace-nowrap">
                                {editingTx ? 'Редактировать' : 'Новый расход'}
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="p-2 bg-[var(--tg-theme-secondary-bg-color,#f3f4f6)] text-[var(--tg-theme-hint-color,#6b7280)] rounded-full active:scale-90 transition-transform">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold text-[var(--tg-theme-hint-color,#6b7280)] mb-1 uppercase tracking-wider">Сумма</label>
                                <div className="flex bg-[var(--tg-theme-secondary-bg-color,#f3f4f6)] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--tg-theme-button-color,#3b82f6)] transition-shadow">
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full bg-transparent text-[var(--tg-theme-text-color,#111827)] text-lg px-4 py-3 border-none outline-none"
                                        placeholder="0.00"
                                    />
                                    <div className="flex border-l border-[var(--tg-theme-hint-color,#e5e7eb)]/30">
                                        <button
                                            onClick={() => setFormData({ ...formData, currency: 'USD' })}
                                            className={`px-4 font-bold text-sm transition-colors ${formData.currency === 'USD' ? 'bg-[var(--tg-theme-button-color,#3b82f6)] text-[var(--tg-theme-button-text-color,#ffffff)]' : 'text-[var(--tg-theme-hint-color,#6b7280)] active:bg-black/5'}`}
                                        >
                                            USD
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, currency: 'RUB' })}
                                            className={`px-4 font-bold text-sm transition-colors ${formData.currency === 'RUB' ? 'bg-[var(--tg-theme-button-color,#3b82f6)] text-[var(--tg-theme-button-text-color,#ffffff)]' : 'text-[var(--tg-theme-hint-color,#6b7280)] active:bg-black/5'}`}
                                        >
                                            RUB
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[var(--tg-theme-hint-color,#6b7280)] mb-1 uppercase tracking-wider">Категория</label>
                                <select
                                    value={formData.categoryId}
                                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                    className="w-full bg-[var(--tg-theme-secondary-bg-color,#f3f4f6)] text-[var(--tg-theme-text-color,#111827)] text-lg px-4 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color,#3b82f6)] appearance-none"
                                >
                                    <option value="" disabled>Выберите категорию</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[var(--tg-theme-hint-color,#6b7280)] mb-1 uppercase tracking-wider">Комментарий</label>
                                <input
                                    type="text"
                                    value={formData.comment}
                                    onChange={e => setFormData({ ...formData, comment: e.target.value })}
                                    className="w-full bg-[var(--tg-theme-secondary-bg-color,#f3f4f6)] text-[var(--tg-theme-text-color,#111827)] text-[15px] px-4 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color,#3b82f6)]"
                                    placeholder="Например, Обед"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mb-2">
                            {editingTx && (
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 max-w-[64px] bg-red-100 text-red-600 flex items-center justify-center rounded-[16px] active:scale-95 transition-all"
                                >
                                    <Trash2 size={24} />
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                className="flex-1 py-4 bg-[var(--tg-theme-button-color,#3b82f6)] text-[var(--tg-theme-button-text-color,#ffffff)] rounded-[16px] font-bold text-lg active:scale-[0.98] transition-all shadow-md"
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
