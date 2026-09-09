import { useEffect, useState, useMemo } from 'react';
import { Settings, Plus, X, Trash2, Lock, Search, ArrowDownUp, Check, Download } from 'lucide-react';
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
    { id: 'forest', name: 'Лесной мох 🌲' },
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
    const [activeTab, setActiveTab] = useState<'finance' | 'charts' | 'rates'>('finance');

    const supportedCurrencies = ['USD', 'RUB', 'EUR', 'THB', 'VND', 'TRY', 'BYN', 'UAH'];

    // Exchange rates logic
    const [exchangeRates, setExchangeRates] = useState<{ rates: Record<string, number>; lastUpdate?: string }>({ rates: { USD: 1, RUB: 90 }, lastUpdate: '' });
    const [calcAmount, setCalcAmount] = useState('');
    const [calcFrom, setCalcFrom] = useState('USD');
    const [calcTo, setCalcTo] = useState('RUB');

    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'expensive' | 'cheap'>('newest');

    const [baseCurrency, setBaseCurrency] = useState(localStorage.getItem('coinflow_default_currency') || 'USD');
    const [secondaryCurrency, setSecondaryCurrency] = useState(localStorage.getItem('coinflow_secondary_currency') || 'RUB');
    const [currencyFilter, setCurrencyFilter] = useState<'ALL' | string>(localStorage.getItem('coinflow_default_currency') || 'USD');

    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('coinflow-theme') || 'default');

    const saveSettings = async (defCur: string, secCur: string) => {
        triggerHaptic('selection');
        setBaseCurrency(defCur);
        setSecondaryCurrency(secCur);
        localStorage.setItem('coinflow_default_currency', defCur);
        localStorage.setItem('coinflow_secondary_currency', secCur);
        if (currencyFilter !== 'ALL') setCurrencyFilter(defCur);

        if (userId) {
            try {
                await axios.put(`${API_BASE_URL}/user/settings`, {
                    userId,
                    defaultCurrency: defCur,
                    secondaryCurrency: secCur
                });
            } catch (e) { console.error("Failed to save settings", e); }
        }
    };

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
                        axios.get(`${API_BASE_URL}/user/settings?userId=${userId}`)
                    ]);
                    setTransactions(txRes.data);
                    setIsPro(userRes.data?.isPro || false);
                    if (userRes.data?.defaultCurrency) {
                        setBaseCurrency(userRes.data.defaultCurrency);
                        if (currencyFilter !== 'ALL') setCurrencyFilter(userRes.data.defaultCurrency);
                        localStorage.setItem('coinflow_default_currency', userRes.data.defaultCurrency);
                    }
                    if (userRes.data?.secondaryCurrency) {
                        setSecondaryCurrency(userRes.data.secondaryCurrency);
                        localStorage.setItem('coinflow_secondary_currency', userRes.data.secondaryCurrency);
                    }
                }

                // Fetch exchange rates
                try {
                    const rateRes = await axios.get('https://open.er-api.com/v6/latest/USD');
                    if (rateRes.data && rateRes.data.rates) {
                        setExchangeRates({
                            rates: rateRes.data.rates,
                            lastUpdate: new Date(rateRes.data.time_last_update_unix * 1000).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                        });
                    }
                } catch (e) {
                    console.error("Failed to fetch rates", e);
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

    const handleTabClick = (tab: 'finance' | 'charts' | 'rates') => {
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

    const [chartsPeriod, setChartsPeriod] = useState<'month' | 'last_month' | 'all'>('month');
    const [chartsCurrency, setChartsCurrency] = useState<'USD' | 'RUB'>('USD');
    const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

    const analyticsData = useMemo(() => {
        const now = new Date();
        const filtered = transactions.filter(tx => {
            if (tx.currency !== chartsCurrency) return false;
            const txDate = new Date(tx.date);
            if (chartsPeriod === 'month') {
                return txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
            } else if (chartsPeriod === 'last_month') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return txDate.getFullYear() === lastMonth.getFullYear() && txDate.getMonth() === lastMonth.getMonth();
            }
            return true;
        });

        const total = filtered.reduce((acc, tx) => acc + tx.amount, 0);

        const catMap = new Map();
        filtered.forEach(tx => {
            const id = tx.category?.id || 'unknown';
            const existing = catMap.get(id) || { name: tx.category?.name || 'Неизвестно', icon: tx.category?.icon || '?', amount: 0 };
            existing.amount += tx.amount;
            catMap.set(id, existing);
        });
        const categoriesList = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);
        const topCategory = categoriesList[0];

        let days = 1;
        if (chartsPeriod === 'month') {
            days = Math.max(1, now.getDate());
        } else if (chartsPeriod === 'last_month') {
            days = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
        } else {
            if (filtered.length > 0) {
                const minDate = Math.min(...filtered.map(t => new Date(t.date).getTime()));
                const maxDate = Math.max(...filtered.map(t => new Date(t.date).getTime()));
                days = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)));
            }
        }
        const avgPerDay = total / days;

        const dailyMap = new Map();
        filtered.forEach(tx => {
            const d = new Date(tx.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            const raw = new Date(tx.date).toISOString().split('T')[0];
            const existing = dailyMap.get(raw) || { day: d, amount: 0, raw };
            existing.amount += tx.amount;
            dailyMap.set(raw, existing);
        });
        const dailyList = Array.from(dailyMap.values()).sort((a, b) => a.raw.localeCompare(b.raw));
        const maxDaily = Math.max(...dailyList.map(d => d.amount), 0);

        return { filtered, total, avgPerDay, topCategory, categoriesList, dailyList, maxDaily };
    }, [transactions, chartsPeriod, chartsCurrency]);

    const exportCSV = () => {
        triggerHaptic('success');
        const header = "Date,Category,Amount,Currency,Comment\n";
        const rows = analyticsData.filtered.map(tx =>
            `"${new Date(tx.date).toLocaleDateString('ru-RU')}","${tx.category?.name || ''}",${tx.amount},"${tx.currency}","${(tx.comment || '').replace(/"/g, '""')}"`
        ).join("\n");
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coinflow_export_${chartsPeriod}.csv`;
        a.click();
        URL.revokeObjectURL(url);
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

    const convertedTotalAmount = useMemo(() => {
        return displayedTransactions.reduce((sum, tx) => {
            if (currencyFilter !== 'ALL') return sum + tx.amount;
            if (tx.currency === baseCurrency) return sum + tx.amount;

            const rateFrom = exchangeRates.rates[tx.currency] || 1;
            const rateTo = exchangeRates.rates[baseCurrency] || 1;

            const amountInUsd = tx.amount / rateFrom;
            return sum + (amountInUsd * rateTo);
        }, 0);
    }, [displayedTransactions, currencyFilter, baseCurrency, exchangeRates.rates]);

    const displayAmount = convertedTotalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

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
                    className={`px-4 py-2.5 rounded-t-2xl font-bold transition-colors ${activeTab === 'finance' ? 'bg-[var(--app-card-bg)] text-[var(--app-text)]' : 'bg-[var(--app-card-bg)]/50 text-[var(--app-hint)] mt-1'}`}
                >
                    Мои финансы
                </button>
                <button
                    onClick={() => handleTabClick('charts')}
                    className={`px-4 py-2.5 rounded-t-2xl font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'charts' ? 'bg-[var(--app-card-bg)] text-[var(--app-text)]' : 'bg-[var(--app-card-bg)]/50 text-[var(--app-hint)] mt-1'}`}
                >
                    Графики {!isPro && <Lock size={14} />}
                </button>
                <button
                    onClick={() => handleTabClick('rates')}
                    className={`px-4 py-2.5 rounded-t-2xl font-bold transition-colors flex items-center gap-1.5 ${activeTab === 'rates' ? 'bg-[var(--app-card-bg)] text-[var(--app-text)]' : 'bg-[var(--app-card-bg)]/50 text-[var(--app-hint)] mt-1'}`}
                >
                    Курсы
                </button>
            </div>

            {activeTab === 'finance' && (
                <>
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
                                <Settings size={24} />
                            </button>
                        </header>

                        <div>
                            <h2 className="text-[var(--app-hint)] text-sm font-medium mb-1">
                                Сумма трат ({currencyFilter === 'ALL' ? baseCurrency : currencyFilter})
                            </h2>
                            <div className="text-4xl font-extrabold text-[var(--app-text)] tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
                                {displayAmount} {currencyFilter !== 'ALL' ? currencyFilter : ''}
                            </div>
                            {currencyFilter === 'ALL' && (
                                <div className="text-[10px] text-[var(--app-hint)] mt-1.5 font-semibold opacity-70">
                                    * сконвертировано в {baseCurrency} по текущему курсу
                                </div>
                            )}
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col gap-3 mt-2">
                            <div className="flex bg-[var(--app-bg)] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--app-button)] transition-shadow">
                                <div className="pl-3 flex items-center text-[var(--app-hint)]">
                                    <Search size={18} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Поиск трат..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-transparent text-[var(--app-text)] text-sm px-3 py-3 outline-none border-none placeholder:text-[var(--app-hint)]"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="pr-3 text-[var(--app-hint)]">
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 hide-scrollbar">
                                <button
                                    onClick={cycleSortMode}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--app-bg)] text-[var(--app-text)] rounded-xl text-xs font-semibold active:scale-95 transition-all whitespace-nowrap whitespace-pre"
                                >
                                    <ArrowDownUp size={14} />
                                    {getSortLabel()}
                                </button>

                                <div className="flex items-center gap-2 bg-[var(--app-bg)] p-1 rounded-xl">
                                    <button
                                        onClick={() => { triggerHaptic('selection'); setCurrencyFilter('ALL'); }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currencyFilter === 'ALL' ? 'bg-[var(--app-button)] text-[var(--app-button-text)] shadow-md' : 'text-[var(--app-text)] opacity-70 hover:opacity-100'}`}
                                    >
                                        ALL
                                    </button>
                                    <button
                                        onClick={() => { triggerHaptic('selection'); setCurrencyFilter(baseCurrency); }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currencyFilter === baseCurrency ? 'bg-[var(--app-button)] text-[var(--app-button-text)] shadow-md' : 'text-[var(--app-text)] opacity-70 hover:opacity-100'}`}
                                    >
                                        {baseCurrency}
                                    </button>
                                    {baseCurrency !== secondaryCurrency && (
                                        <button
                                            onClick={() => { triggerHaptic('selection'); setCurrencyFilter(secondaryCurrency); }}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currencyFilter === secondaryCurrency ? 'bg-[var(--app-button)] text-[var(--app-button-text)] shadow-md' : 'text-[var(--app-text)] opacity-70 hover:opacity-100'}`}
                                        >
                                            {secondaryCurrency}
                                        </button>
                                    )}
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
                </>
            )}

            {activeTab === 'charts' && (
                <div className="flex flex-col gap-6 bg-[var(--app-card-bg)] rounded-3xl rounded-tl-none p-5 shadow-sm border border-[var(--app-border)]/40 transition-colors pb-8 min-h-[70vh]">
                    {/* Charts Filters */}
                    <div className="flex justify-between items-center gap-2">
                        <select
                            value={chartsPeriod}
                            onChange={e => setChartsPeriod(e.target.value as any)}
                            className="bg-[var(--app-bg)] text-[var(--app-text)] font-semibold text-sm px-3 py-2 rounded-lg outline-none border-none focus:ring-2 focus:ring-[var(--app-button)]"
                        >
                            <option value="month">Этот месяц</option>
                            <option value="last_month">Прошлый месяц</option>
                            <option value="all">Всё время</option>
                        </select>
                        <div className="flex bg-[var(--app-bg)] rounded-lg p-0.5">
                            {(['USD', 'RUB'] as const).map(cur => (
                                <button
                                    key={cur}
                                    onClick={() => { triggerHaptic('selection'); setChartsCurrency(cur); }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${chartsCurrency === cur ? 'bg-[var(--app-button)] text-[var(--app-button-text)] shadow-sm' : 'text-[var(--app-hint)]'}`}
                                >
                                    {cur}
                                </button>
                            ))}
                        </div>
                    </div>

                    {analyticsData.filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-centeropacity-70 py-10 mt-10">
                            <div className="text-4xl mb-3 opacity-50">📂</div>
                            <span className="text-[var(--app-hint)] font-medium text-sm">За выбранный период трат не найдено</span>
                        </div>
                    ) : (
                        <>
                            {/* KPI Board */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[var(--app-bg)] p-3 rounded-2xl flex flex-col items-start min-w-0">
                                    <span className="text-[10px] text-[var(--app-hint)] uppercase font-bold tracking-wider mb-1">Всего потрачено</span>
                                    <span className="text-[var(--app-text)] font-extrabold text-lg truncate w-full">{analyticsData.total.toLocaleString('ru-RU')} {chartsCurrency}</span>
                                </div>
                                <div className="bg-[var(--app-bg)] p-3 rounded-2xl flex flex-col items-start min-w-0">
                                    <span className="text-[10px] text-[var(--app-hint)] uppercase font-bold tracking-wider mb-1">В среднем в день</span>
                                    <span className="text-[var(--app-text)] font-extrabold text-lg truncate w-full">{Math.round(analyticsData.avgPerDay).toLocaleString('ru-RU')} {chartsCurrency}</span>
                                </div>
                                <div className="bg-[var(--app-bg)] p-3 rounded-2xl flex flex-col items-start min-w-0 col-span-2">
                                    <span className="text-[10px] text-[var(--app-hint)] uppercase font-bold tracking-wider mb-1">Главная статья трат</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{analyticsData.topCategory.icon}</span>
                                        <div className="flex flex-col">
                                            <span className="text-[var(--app-text)] font-bold text-sm w-full">{analyticsData.topCategory.name}</span>
                                            <span className="text-[var(--app-button)] text-xs font-semibold">{Math.round((analyticsData.topCategory.amount / analyticsData.total) * 100)}% от пула</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Donut Chart Block */}
                            <div className="flex flex-col items-center justify-center py-4 bg-[var(--app-bg)] rounded-3xl relative">
                                <h3 className="w-full pl-5 mb-2 text-[var(--app-text)] font-bold text-sm text-left opacity-90">Распределение</h3>

                                <div className="relative w-48 h-48 mt-4 flex items-center justify-center">
                                    <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90 filter drop-shadow-md">
                                        <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="var(--app-border)" strokeWidth="3" className="opacity-10"></circle>
                                        {(() => {
                                            let offset = 0;
                                            return analyticsData.categoriesList.map((cat, i) => {
                                                const ratio = (cat.amount / analyticsData.total) * 100;
                                                const dasharray = `${ratio} ${100 - ratio}`;
                                                const dashoffset = 100 - offset;
                                                offset += ratio;
                                                return (
                                                    <circle
                                                        key={cat.name} cx="21" cy="21" r="15.91549430918954"
                                                        fill="transparent"
                                                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                                        strokeWidth="4"
                                                        strokeDasharray={dasharray}
                                                        strokeDashoffset={dashoffset}
                                                        strokeLinecap="round"
                                                        className="transition-all duration-1000 ease-out"
                                                    />
                                                );
                                            });
                                        })()}
                                    </svg>
                                    <div className="absolute flex flex-col items-center justify-center text-center max-w-[60%]">
                                        <span className="text-[var(--app-hint)] text-[10px] uppercase font-bold tracking-widest">Итог</span>
                                        <span className="text-[var(--app-text)] font-black text-xl truncate">{analyticsData.total.toLocaleString('ru')}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 w-full mt-6 px-4">
                                    {analyticsData.categoriesList.map((cat, i) => (
                                        <div key={cat.name} className="flex justify-between items-center text-sm font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></div>
                                                <span className="text-[var(--app-text)] opacity-90">{cat.icon} {cat.name}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="text-[var(--app-text)] font-semibold text-right">{cat.amount.toLocaleString()} {chartsCurrency}</span>
                                                <span className="text-[var(--app-hint)] text-xs w-8 text-right font-bold opacity-60">{Math.round((cat.amount / analyticsData.total) * 100)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bar Chart Timeline */}
                            <div className="bg-[var(--app-bg)] p-5 rounded-3xl flex flex-col gap-2 items-center justify-end h-40">
                                <h3 className="w-full text-[var(--app-text)] font-bold text-sm text-left mb-auto">Динамика по дням</h3>
                                <div className="flex items-end justify-between w-full h-[80px] gap-1 group relative">
                                    {analyticsData.dailyList.map(d => {
                                        const height = Math.max(8, (d.amount / analyticsData.maxDaily) * 100);
                                        return (
                                            <div key={d.day} className="flex flex-col items-center flex-1 justify-end group/bar relative">
                                                <div
                                                    className="w-full max-w-[12px] bg-[var(--app-button)] rounded-sm transition-all duration-500 ease-out hover:bg-opacity-80 cursor-pointer"
                                                    style={{ height: `${height}%` }}
                                                ></div>
                                                <div className="absolute bottom-[calc(100%+6px)] hidden group-hover/bar:flex bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                                    {d.day}: {d.amount} {chartsCurrency}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <button
                                onClick={exportCSV}
                                className="mt-2 w-full py-3.5 bg-green-500/10 text-green-600 dark:text-green-500 rounded-[16px] font-bold text-[15px] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                            >
                                <Download size={18} /> Экспорт в CSV
                            </button>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'rates' && (
                <div className="flex flex-col gap-6 bg-[var(--app-card-bg)] rounded-3xl rounded-tl-none p-5 shadow-sm border border-[var(--app-border)]/40 transition-colors pb-8 min-h-[70vh]">
                    <div className="flex flex-col items-center justify-center p-6 bg-[var(--app-bg)] rounded-3xl relative overflow-hidden">
                        <span className="text-[var(--app-hint)] text-xs uppercase font-bold tracking-widest mb-1 z-10">Текущий кросс-курс</span>
                        <div className="text-3xl font-black text-[var(--app-text)] z-10">
                            1 {baseCurrency} = {((exchangeRates.rates[secondaryCurrency] || 1) / (exchangeRates.rates[baseCurrency] || 1)).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {secondaryCurrency}
                        </div>
                        <span className="text-[var(--app-hint)] text-[10px] mt-2 opacity-60 z-10">
                            Обновлено: {exchangeRates.lastUpdate || 'Сейчас'}
                        </span>

                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--app-button)]/10 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[var(--app-button)]/10 rounded-full blur-2xl"></div>
                    </div>

                    <div className="flex flex-col gap-4 mt-2">
                        <h3 className="text-xs font-bold text-[var(--app-hint)] uppercase tracking-wider pl-1">Калькулятор</h3>

                        <div className="flex bg-[var(--app-bg)] rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--app-button)] transition-shadow">
                            <input
                                type="number"
                                value={calcAmount}
                                onChange={e => setCalcAmount(e.target.value)}
                                placeholder="Сумма..."
                                className="w-full bg-transparent text-[var(--app-text)] text-lg px-4 py-4 outline-none border-none font-semibold text-center"
                            />
                            <div className="flex pl-2 py-2 pr-2 bg-[var(--app-card-bg)] gap-2 border-l border-[var(--app-border)]/30">
                                <select
                                    className="bg-transparent text-[var(--app-text)] font-black text-xs outline-none"
                                    value={calcFrom}
                                    onChange={e => setCalcFrom(e.target.value)}
                                >
                                    {supportedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button
                                    onClick={() => {
                                        triggerHaptic('selection');
                                        const temp = calcFrom;
                                        setCalcFrom(calcTo);
                                        setCalcTo(temp);
                                    }}
                                    className="flex items-center justify-center text-[var(--app-button)]"
                                >
                                    <ArrowDownUp size={16} />
                                </button>
                                <select
                                    className="bg-transparent text-[var(--app-text)] font-black text-xs outline-none"
                                    value={calcTo}
                                    onChange={e => setCalcTo(e.target.value)}
                                >
                                    {supportedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-[var(--app-bg)] p-4 rounded-2xl flex flex-col items-center justify-center mt-2 shadow-inner">
                            <span className="text-[var(--app-hint)] text-[10px] uppercase font-bold tracking-widest mb-1">Итого</span>
                            <span className="text-2xl font-black text-[var(--app-text)]">
                                {(() => {
                                    const val = parseFloat(calcAmount);
                                    if (isNaN(val)) return '0.00';
                                    const rateFrom = exchangeRates.rates[calcFrom] || 1;
                                    const rateTo = exchangeRates.rates[calcTo] || 1;
                                    const amountInUsd = val / rateFrom;
                                    const result = amountInUsd * rateTo;
                                    return result.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + calcTo;
                                })()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Модалка Тем / Настроек */}
            {themeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setThemeModalOpen(false); }}>
                    <div className="bg-[var(--app-card-bg)] w-full max-w-md rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-[slideUp_0.3s_ease-out]">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-[var(--app-text)]">Настройки</h2>
                            <button onClick={() => setThemeModalOpen(false)} className="p-2 bg-[var(--app-bg)] text-[var(--app-hint)] rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-5">
                            {/* Базовая валюта */}
                            <div>
                                <h3 className="text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wider mb-2">Основные валюты дашборда</h3>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between bg-[var(--app-bg)] rounded-xl py-2 px-3">
                                        <span className="text-sm font-semibold text-[var(--app-text)] opacity-80">Основная валюта</span>
                                        <select
                                            value={baseCurrency}
                                            onChange={e => saveSettings(e.target.value, secondaryCurrency)}
                                            className="bg-transparent text-[var(--app-text)] font-bold text-sm outline-none"
                                        >
                                            {supportedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between bg-[var(--app-bg)] rounded-xl py-2 px-3">
                                        <span className="text-sm font-semibold text-[var(--app-text)] opacity-80">Вторая валюта (Быстрый доступ)</span>
                                        <select
                                            value={secondaryCurrency}
                                            onChange={e => saveSettings(baseCurrency, e.target.value)}
                                            className="bg-transparent text-[var(--app-text)] font-bold text-sm outline-none"
                                        >
                                            {supportedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Оформление */}
                            <div>
                                <h3 className="text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wider mb-2">Оформление</h3>
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
                                            onClick={() => { triggerHaptic('selection'); setFormData({ ...formData, currency: baseCurrency }); }}
                                            className={`px-4 font-bold text-sm transition-colors ${formData.currency === baseCurrency ? 'bg-[var(--app-button)] text-[var(--app-button-text)]' : 'text-[var(--app-hint)] active:bg-black/5'}`}
                                        >
                                            {baseCurrency}
                                        </button>
                                        <button
                                            onClick={() => { triggerHaptic('selection'); setFormData({ ...formData, currency: secondaryCurrency }); }}
                                            className={`px-4 font-bold text-sm transition-colors ${formData.currency === secondaryCurrency ? 'bg-[var(--app-button)] text-[var(--app-button-text)]' : 'text-[var(--app-hint)] active:bg-black/5'}`}
                                        >
                                            {secondaryCurrency}
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
