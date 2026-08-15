import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useToast } from './toast';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const request = async (path: string, token?: string, options?: RequestInit) => {
    const res = await fetch(API + path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Request failed');
    }

    return res.status === 204 ? null : res.json();
};

type AdminQuote = {
    id: string;
    quote: string;
    author: string;
    category: string;
    finalImageUrl?: string;
    attribution?: string;
    tags?: string[];
    creator?: string;
};

export default function AdminManageQuotes({ token }: { token: string }) {
    const [query, setQuery] = useState('');
    const [quotes, setQuotes] = useState<AdminQuote[]>([]);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [pendingDeleteQuote, setPendingDeleteQuote] = useState<string | null>(null);
    const toast = useToast();

    const load = async (q = '') => {
        try {
            const res = await request(`/quotes${q ? `?q=${encodeURIComponent(q)}` : ''}`, token);
            setQuotes(Array.isArray(res) ? res : []);
        } catch (err) {
            setNotice((err as Error).message);
        }
    };

    useEffect(() => {
        if (!token) return;
        load();
    }, [token]);

    const promptRemove = (id: string, quoteText: string) => {
        setPendingDeleteId(id);
        setPendingDeleteQuote(quoteText);
        setConfirmOpen(true);
    };

    const remove = async () => {
        if (!pendingDeleteId) return;

        setConfirmOpen(false);
        setBusy(true);
        setNotice('');

        try {
            await request(`/admin/quotes/${pendingDeleteId}`, token, { method: 'DELETE' });
            setQuotes((prev) => prev.filter((q) => q.id !== pendingDeleteId));
            setNotice('Quote deleted.');
        } catch (err) {
            const msg = (err as Error).message;
            setNotice(msg);
            toast.push({ message: msg, type: 'error' });
        } finally {
            setBusy(false);
            setPendingDeleteId(null);
            setPendingDeleteQuote(null);
        }
    };

    const IMAGE_BASE_URL = (import.meta.env.VITE_IMAGE_URL || '').replace(/\/+$/, '');

    const getImageUrl = (imageUrl?: string | null) => {
        if (!imageUrl?.trim()) return '';

        const value = imageUrl.trim();

        // Backend returned a complete URL: use it exactly as returned.
        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value;
        }

        // Backend returned a local/relative path: prefix the configured image base URL.
        if (!IMAGE_BASE_URL) {
            return value;
        }

        return `${IMAGE_BASE_URL}/${value.replace(/^\/+/, '')}`;
    };

    return (
        <section className="page studio">
            <p className="eyebrow">ADMIN</p>
            <h1>Manage quotes</h1>

            <div style={{ margin: '12px 0 18px', display: 'flex', gap: 8 }}>
                <input
                    placeholder="Search quotes, author, or category"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ flex: 1 }}
                />
                <button
                    className="gold"
                    onClick={() => load(query)}
                    disabled={busy}
                >
                    Search
                </button>
            </div>

            {notice && <p className="small">{notice}</p>}

            <div style={{ display: 'grid', gap: 12 }}>
                {quotes.map((q) => (
                    <div key={q.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', padding: 12, borderRadius: 8, border: '1px solid var(--line)' }}>
                        {q.finalImageUrl ? (
                            <img src={getImageUrl(q.finalImageUrl)} alt={q.quote} style={{ width: 120, height: 84, objectFit: 'cover', borderRadius: 8 }} />
                        ) : (
                            <div style={{ width: 120, height: 84, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }} />
                        )}

                        <div style={{ flex: 1 }}>
                            <strong style={{ display: 'block' }}>{q.quote}</strong>
                            <div className="muted">— {q.author}{q.category ? ` · ${q.category}` : ''}</div>
                            {q.tags && q.tags.length > 0 && (
                                <div className="small" style={{ marginTop: 6 }}>Tags: {q.tags.join(', ')}</div>
                            )}
                            <div className="small" style={{ marginTop: 6 }}>Creator: {q.creator}</div>
                        </div>

                        <div>
                            <button type="button" className="collectionDeleteButton" onClick={() => promptRemove(q.id, q.quote)} title="Delete quote">
                                <Trash2 />
                            </button>
                        </div>
                    </div>
                ))}

                {!quotes.length && <p className="empty">No quotes found.</p>}
            </div>
            <ConfirmModal
                open={confirmOpen}
                title="Delete quote"
                message={pendingDeleteQuote ? (
                    <>
                        Are you sure you want to delete this quote for the whole site?
                        <div style={{ marginTop: 8 }}><strong>“{pendingDeleteQuote}”</strong></div>
                    </>
                ) : 'Are you sure you want to delete this quote for the whole site?'}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={remove}
                onCancel={() => setConfirmOpen(false)}
            />
        </section>
    );
}

