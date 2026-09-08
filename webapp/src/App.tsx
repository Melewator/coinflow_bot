import { useEffect, useState, useMemo } from 'react';
import { Wallet, Plus, X, Trash2, Lock, Search, ArrowDownUp, Check } from 'lucide-react';
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

const THEMES = [
    { id: 'default', name: 'Системная (Telegram)' },
    { id: 'dark-slate', name: 'Тёмная классика' },
    { id: 'oled', name: 'OLED Black' },
    { id: 'emerald', name: 'Изумруд' },
    { id: 'light', name: 'Светлая тема' },
];

function App() {
    const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = tgUser?.id ? String(tgUser.id) : '';

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [formData, setFormData] = useState({ amount: '', categoryId: '', comment: '', currency: 'USD' });

    // UI Стейты
    const [activeTab, setActiveTab] = useState<'finance' | 'charts'>('finance');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'expensive' | 'cheap'>('newest');
    const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'USD' | 'RUB'>('ALL');
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('coinflow-theme') || 'default');

    // PRO Статус
    const [isPro, setIsPro] = useState(false);
    const [proModalOpen, setProModalOpen] = useState(false);
    const [showPromoInput, setShowPromoInput] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [promoError, setPromoError] = useState('');

    const rawUrl = (import.meta as any).env?.VITE_API_URL || 'https://coinflow-bot.onrender.com/api';
    const API_BASE_URL = rawUrl.replace(/\/+$/, '');

    const triggerHaptic = (type: 'success' | 'error' | 'warning' | 'selection') => {
        const haptic = (window as any).Telegram?.WebApp?.HapticFeedback;
        if (haptic) {
            if (type === 'selection') haptic.selectionChanged();
            else haptic.notificationOccurred(type);
        }
    };

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
        }

        if (currentTheme !== 'default') {
            document.documentElement.setAttribute('data-theme', currentTheme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        const loadInitialData = async () => {
            if (!userId) setLoading(false);
            try {
                const catsRes = await axios.get(`${API_BASE_URL}/categories?userId=${userId}`);
                setCategories(catsRes.data);

                if (userId) {
                    const [txRes, userRes] = await Promise.all([
                        axios.get(`${API_BASE_URL}/transactions/${userId}`),
                        axios.get(`${API_BASE_URL}/user/${userId}`)
                    ]);
                    setTransactions(txRes.data);
                    setIsPro(userRes.data?.isPro || false);
                }
            } catch (err) {
                console.error("Data load error:", err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [userId, API_BASE_URL]);

    const changeTheme = (themeId: string) => {
        triggerHaptic('selection');
        setCurrentTheme(themeId);
        localStorage.setItem('coinflow-theme', themeId);
        if (themeId !== 'default') {
            document.documentElement.setAttribute('data-theme', themeId);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        setThemeModalOpen(false);
    };

    const cycleSortMode = () => {
        triggerHaptic('selection');
        const modes: ('newest' | 'oldest' | 'expensive' | 'cheap')[] = ['newest', 'oldest', 'expensive', 'cheap'];
        const nextIndex = (modes.indexOf(sortMode) + 1) % modes.length;
        setSortMode(modes[nextIndex]);
    };

    const getSortLabel = () => {
        if (sortMode === 'newest') return 'Сначала новые';
        if (sortMode === 'oldest') return 'Сначала старые';
        if (sortMode === 'expensive') return 'Сначала дорогие';
        return 'Сначала дешевые';
    };

    const handleTabClick = (tab: 'finance' | 'charts') => {
        if (tab === 'charts') {
            triggerHaptic('selection');
            if (!isPro) {
                setProModalOpen(true);
                return;
            }
            setActiveTab('charts');
            return;
        }
        triggerHaptic('selection');
        setActiveTab(tab);
    };

    const handleBuyPro = async () => {
        triggerHaptic('selection');
        try {
            const res = await axios.post(`${API_BASE_URL}/payments/create-invoice`, { userId });
            const { invoiceLink } = res.data;

            const tg = (window as any).Telegram?.WebApp;
            if (tg && tg.openInvoice) {
                tg.openInvoice(invoiceLink, (status: string) => {
                    if (status === 'paid') {
                        triggerHaptic('success');
                        setIsPro(true);
                        setProModalOpen(false);
                        setActiveTab('charts');
                    } else {
                        triggerHaptic('warning');
                        console.log('Оплата отменена или не удалась');
                    }
                });
            } else {
                alert("Функция оплаты недоступна в текущем окружении Телеграм.");
            }
        } catch (e) {
            console.error(e);
            triggerHaptic('error');
            alert('Ошибка сервера при создании платежа');
        }
    };

    const handleRedeemPromo = async () => {
        if (!promoCode.trim()) return;
        triggerHaptic('selection');
        try {
            const res = await axios.post(`${API_BASE_URL}/promocodes/redeem`, { userId, code: promoCode });
            if (res.data.success) {
                triggerHaptic('success');
                setIsPro(true);
                setProModalOpen(false);
                setActiveTab('charts');
                alert(res.data.message);
            }
        } catch (e: any) {
            triggerHaptic('error');
            setPromoError(e.response?.data?.message || 'Ошибка активации');
            setTimeout(() => setPromoError(''), 3000);
        }
    };

    const handleOpenModal = (tx: Transaction | null = null) => {
        triggerHaptic('selection');
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
                const res = await axios.put(`${API_BASE_URL}/transactions/${editingTx.id}`, formData);
                setTransactions(prev => prev.map(t => t.id === editingTx.id ? res.data : t));
            } else {
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

    const displayedTransactions = useMemo(() => {
        let filtered = transactions.filter(t => {
            const matchSearch = (t.comment || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.category?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchCurrency = currencyFilter === 'ALL' || t.currency === currencyFilter;
            return matchSearch && matchCurrency;
        });

        filtered.sort((a, b) => {
            if (sortMode === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
            if (sortMode === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
            if (sortMode === 'expensive') return b.amount - a.amount;
            if (sortMode === 'cheap') return a.amount - b.amount;
            return 0;
        });

        return filtered;
    }, [transactions, searchQuery, sortMode, currencyFilter]);

    const totalAmount = displayedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const displayAmount = totalAmount.toLocaleString('ru-RU');

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="min-h-screen bg-[var(--app-bg)] p-4 pt-1 flex flex-col gap-5 font-sans relative pb-28">

            {/* Folder Tabs */}
            <div className="flex px-2 pt-3">
                <button
                    onClick={() => handleTabClick('finance')}
                    className={`px-5 py-2.5 rounded-t-2xl font-bold transition-colors ${activeTab === 'finance' ? 'bg-[var(--app-card-bg)] text-[var(--app-text)]' : 'bg-[var(--app-card-bg)]/50 text-[var(--app-hint)] mt-1'}`}
                >
                    Мои финансы
                </button>
                <button
                    onClick={() => handleTabClick('charts')}
                    className={`px-5 py-2.5 rounded-t-2xl font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'charts' ? 'bg-[var(--app-card-bg)] text-[var(--app-text)]' : 'bg-[var(--app-card-bg)]/50 text-[var(--app-hint)] mt-1'}`}
                >
                    Графики {!isPro && <Lock size={14} />}
                </button>
            </div>

            <div className="flex flex-col gap-5 bg-[var(--app-card-bg)] rounded-3xl rounded-tl-none p-5 shadow-sm border border-[var(--app-border)]/40 transition-colors">

                <header className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-[var(--app-text)] text-2xl font-bold tracking-tight">
                            Баланс
                        </h1>
                        <p className="text-[var(--app-hint)] text-sm mt-0.5">
                            {tgUser?.first_name ? `Привет, ${tgUser.first_name}!` : 'Демо-режим'}
                        </p>
                    </div>
                    <button
                        onClick={() => { triggerHaptic('selection'); setThemeModalOpen(true); }}
                        className="w-12 h-12 bg-gradient-to-tr from-[var(--app-button)] to-[var(--app-button)]/70 text-[var(--app-button-text)] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    >
                        <Wallet size={24} />
                    </button>
                </header>

                <div>
                    <h2 className="text-[var(--app-hint)] text-sm font-medium mb-1">Сумма трат ({currencyFilter === 'ALL' ? 'MIX' : currencyFilter})</h2>
                    <div className="text-4xl font-extrabold text-[var(--app-text)] tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
                        {displayAmount} {currencyFilter !== 'ALL' ? currencyFilter : ''}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-3 mt-2">
                    <div className="flex bg-[var(--app-bg)] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--app-button)] transition-shadow">
                        <div className="pl-3 flex items-center text-[var(--app-hint)]">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по тратам..."
                            className="w-full bg-transparent text-[var(--app-text)] text-sm px-3 py-2.5 outline-none"
                        />
                    </div>

                    <div className="flex justify-between items-center gap-2">
                        <button
                            onClick={cycleSortMode}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--app-bg)] text-[var(--app-text)] rounded-lg text-xs font-semibold active:scale-95 transition-all"
                        >
                            <ArrowDownUp size={14} />
                            {getSortLabel()}
                        </button>

                        <div className="flex bg-[var(--app-bg)] rounded-lg p-0.5">
                            {(['ALL', 'USD', 'RUB'] as const).map(cur => (
                                <button
                                    key={cur}
                                    onClick={() => { triggerHaptic('selection'); setCurrencyFilter(cur); }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${currencyFilter === cur ? 'bg-[var(--app-card-bg)] text-[var(--app-text)] shadow-sm' : 'text-[var(--app-hint)]'}`}
                                >
                                    {cur}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-3 flex-1 pb-4">
                {loading ? (
                    <div className="text-center text-[var(--app-hint)] py-4">Загрузка...</div>
                ) : displayedTransactions.length === 0 ? (
                    <div className="text-center text-[var(--app-hint)] py-4">Ничего не найдено.</div>
                ) : (
                    displayedTransactions.map((tx) => (
                        <div
                            key={tx.id}
                            onClick={() => handleOpenModal(tx)}
                            className="cursor-pointer bg-[var(--app-card-bg)] rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-transparent active:border-[var(--app-button)] active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-[46px] h-[46px] flex-shrink-0 rounded-[16px] bg-[var(--app-bg)] flex items-center justify-center text-xl shadow-inner">
                                    {tx.category?.icon || '🏷️'}
                                </div>
                                <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-bold text-[var(--app-text)] text-[15px] truncate">{tx.category?.name || 'Без категории'}</span>
                                    <span className="text-[12px] text-[var(--app-hint)] font-medium truncate">
                                        {tx.comment || formatDate(tx.date)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end flex-shrink-0 pl-1">
                                <span className="font-extrabold text-[16px] text-[var(--app-text)] whitespace-nowrap">
                                    -{tx.amount} <span className="text-[14px] text-[var(--app-hint)] opacity-80">{tx.currency}</span>
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <footer className="mt-auto pt-6 pb-2">
                <p className="text-xs font-semibold text-[var(--app-hint)] text-center tracking-wide opacity-50">
                    CoinFlow v1.0 • 2026
                </p>
            </footer>

            {/* FAB */}
            <button
                onClick={() => handleOpenModal()}
                className="fixed bottom-6 right-6 w-[56px] h-[56px] bg-[var(--app-button)] text-[var(--app-button-text)] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 transition-transform"
            >
                <Plus size={28} className="stroke-[3]" />
            </button>

            {/* Модалка Тем */}
            {themeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setThemeModalOpen(false); }}>
                    <div className="bg-[var(--app-card-bg)] w-full max-w-md rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-[slideUp_0.3s_ease-out]">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-[var(--app-text)]">Выбор темы</h2>
                            <button onClick={() => setThemeModalOpen(false)} className="p-2 bg-[var(--app-bg)] text-[var(--app-hint)] rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {THEMES.map(theme => (
                                <button
                                    key={theme.id}
                                    onClick={() => changeTheme(theme.id)}
                                    className={`flex items-center justify-between p-4 rounded-xl text-left font-bold transition-all ${currentTheme === theme.id ? 'bg-[var(--app-button)]/10 text-[var(--app-button)] border border-[var(--app-button)]/30' : 'bg-[var(--app-bg)] text-[var(--app-text)] border border-transparent'}`}
                                >
                                    {theme.name}
                                    {currentTheme === theme.id && <Check size={20} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Модалка Редактирования/Создания */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
                    <div className="bg-[var(--app-card-bg)] w-full max-w-md rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-[slideUp_0.3s_ease-out]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[var(--app-text)]">
                                {editingTx ? 'Редактировать' : 'Новый расход'}
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="p-2 bg-[var(--app-bg)] text-[var(--app-hint)] rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1 uppercase tracking-wider">Сумма</label>
                                <div className="flex bg-[var(--app-bg)] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--app-button)] transition-shadow">
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full bg-transparent text-[var(--app-text)] text-lg px-4 py-3 border-none outline-none"
                                        placeholder="0.00"
                                    />
                                    <div className="flex border-l border-[var(--app-border)]/30">
                                        <button
                                            onClick={() => { triggerHaptic('selection'); setFormData({ ...formData, currency: 'USD' }); }}
                                            className={`px-4 font-bold text-sm transition-colors ${formData.currency === 'USD' ? 'bg-[var(--app-button)] text-[var(--app-button-text)]' : 'text-[var(--app-hint)] active:bg-black/5'}`}
                                        >
                                            USD
                                        </button>
                                        <button
                                            onClick={() => { triggerHaptic('selection'); setFormData({ ...formData, currency: 'RUB' }); }}
                                            className={`px-4 font-bold text-sm transition-colors ${formData.currency === 'RUB' ? 'bg-[var(--app-button)] text-[var(--app-button-text)]' : 'text-[var(--app-hint)] active:bg-black/5'}`}
                                        >
                                            RUB
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1 uppercase tracking-wider">Категория</label>
                                <select
                                    value={formData.categoryId}
                                    onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                                    className="w-full bg-[var(--app-bg)] text-[var(--app-text)] text-lg px-4 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-[var(--app-button)] appearance-none"
                                >
                                    <option value="" disabled>Выберите категорию</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[var(--app-hint)] mb-1 uppercase tracking-wider">Комментарий</label>
                                <input
                                    type="text"
                                    value={formData.comment}
                                    onChange={e => setFormData({ ...formData, comment: e.target.value })}
                                    className="w-full bg-[var(--app-bg)] text-[var(--app-text)] text-[15px] px-4 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-[var(--app-button)]"
                                    placeholder="Например, Обед"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mb-2">
                            {editingTx && (
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 max-w-[64px] bg-red-500/10 text-red-500 flex items-center justify-center rounded-[16px] active:scale-95 transition-all"
                                >
                                    <Trash2 size={24} />
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                className="flex-1 py-4 bg-[var(--app-button)] text-[var(--app-button-text)] rounded-[16px] font-bold text-lg active:scale-[0.98] transition-all shadow-md"
                            >
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ПРО Модалка */}
            {proModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setProModalOpen(false); }}>
                    <div className="bg-[var(--app-card-bg)] w-full max-w-md rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-[slideUp_0.3s_ease-out]">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-extrabold text-[var(--app-text)] tracking-tight">Разблокируйте PRO</h2>
                            <button onClick={() => setProModalOpen(false)} className="p-2 bg-[var(--app-bg)] text-[var(--app-hint)] rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-3 mb-6 font-medium text-[var(--app-text)]">
                            <div className="flex items-center gap-3">
                                <span className="text-[var(--app-button)] text-xl">💎</span>
                                <span>Пожизненный доступ к аналитике</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[var(--app-button)] text-xl">🚀</span>
                                <span>Продвинутые графики и диаграммы</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[var(--app-button)] text-xl">🎨</span>
                                <span>Премиум темы (эксклюзив)</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={handleBuyPro}
                                className="w-full py-4 bg-[#212121] text-white rounded-[16px] font-bold active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-0.5 relative overflow-hidden shadow-lg shadow-black/20"
                            >
                                <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full rotate-[12deg] shadow-sm">-80%</span>
                                <div className="flex items-center gap-2 text-[18px]">
                                    ⭐️ Купить за 5 XTR
                                </div>
                                <div className="text-[12px] text-white/50 line-through">25 XTR (без скидки)</div>
                            </button>

                            {!showPromoInput ? (
                                <button
                                    onClick={() => setShowPromoInput(true)}
                                    className="text-xs text-[var(--app-button)] font-semibold underline underline-offset-2 opacity-80 text-center w-full mt-1"
                                >
                                    У меня есть промокод
                                </button>
                            ) : (
                                <div className="flex flex-col gap-2 mt-2 bg-[var(--app-bg)] p-3 rounded-2xl animate-fade-in">
                                    <div className="flex bg-[var(--app-card-bg)] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--app-button)] border border-[var(--app-border)]/30">
                                        <input
                                            type="text"
                                            value={promoCode}
                                            onChange={e => setPromoCode(e.target.value)}
                                            placeholder="Введите код"
                                            className="w-full bg-transparent text-[var(--app-text)] text-sm px-4 py-3 outline-none uppercase font-bold"
                                        />
                                        <button
                                            onClick={handleRedeemPromo}
                                            className="px-4 bg-[var(--app-button)] text-[var(--app-button-text)] font-semibold active:opacity-80 transition-opacity"
                                        >
                                            OK
                                        </button>
                                    </div>
                                    {promoError && <p className="text-red-500 text-xs text-center font-semibold mt-1">{promoError}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
