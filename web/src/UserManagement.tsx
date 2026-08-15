import React, { useEffect, useMemo, useState } from 'react';

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const USERS_URL = `${API_BASE_URL}/admin/users`;

// ============================================================
// TYPES
// ============================================================

type User = {
    id: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
};

type CreateUserForm = {
    email: string;
    displayName: string;
    password: string;
    isAdmin: boolean;
};

type EditUserForm = {
    displayName: string;
    isAdmin: boolean;
};

// ============================================================
// AUTH
// ============================================================
//
// If your application uses cookie authentication,
// credentials: 'include' is enough.
//
// If you use Bearer/JWT authentication, add your existing
// Authorization header here.
// ============================================================

const getRequestOptions = (token?: string,
    options: RequestInit = {}
): RequestInit => {
    return {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers ?? {}),
        },
    };
};

// ============================================================
// COMPONENT
// ============================================================

export default function UserManagement({ token }: { token: string }) {


    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ----------------------------------------------------------
    // Search / filtering
    // ----------------------------------------------------------

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<
        'all' | 'admin' | 'user'
    >('all');

    // ----------------------------------------------------------
    // Editing
    // ----------------------------------------------------------

    const [editingUser, setEditingUser] = useState<User | null>(null);

    const [editForm, setEditForm] = useState<EditUserForm>({
        displayName: '',
        isAdmin: false,
    });

    const [savingEdit, setSavingEdit] = useState(false);

    // ----------------------------------------------------------
    // Creating
    // ----------------------------------------------------------

    const [showCreate, setShowCreate] = useState(false);

    const [createForm, setCreateForm] = useState<CreateUserForm>({
        email: '',
        displayName: '',
        password: '',
        isAdmin: false,
    });

    const [creating, setCreating] = useState(false);

    // ----------------------------------------------------------
    // Delete
    // ----------------------------------------------------------

    const [deletingUserId, setDeletingUserId] = useState<string | null>(
        null
    );

    // ==========================================================
    // LOAD USERS
    // ==========================================================

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(
                USERS_URL,
                getRequestOptions(token, {
                    method: 'GET',
                })
            );

            if (!response.ok) {
                const body = await response.json().catch(() => null);

                throw new Error(
                    body?.message ||
                    `Failed to load users (${response.status}).`
                );
            }

            const data: User[] = await response.json();

            setUsers(data);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to load users.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    // ==========================================================
    // FILTER USERS
    // ==========================================================

    const filteredUsers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return users.filter((user) => {
            const matchesSearch =
                !normalizedSearch ||
                user.email.toLowerCase().includes(normalizedSearch) ||
                user.displayName.toLowerCase().includes(normalizedSearch);

            const matchesRole =
                roleFilter === 'all' ||
                (roleFilter === 'admin' && user.isAdmin) ||
                (roleFilter === 'user' && !user.isAdmin);

            return matchesSearch && matchesRole;
        });
    }, [users, search, roleFilter]);

    // ==========================================================
    // EDIT USER
    // ==========================================================

    const startEditing = (user: User) => {
        setError('');
        setSuccess('');

        setEditingUser(user);

        setEditForm({
            displayName: user.displayName,
            isAdmin: user.isAdmin,
        });
    };

    const cancelEditing = () => {
        if (savingEdit) return;

        setEditingUser(null);

        setEditForm({
            displayName: '',
            isAdmin: false,
        });
    };

    const saveUser = async () => {
        if (!editingUser) return;

        try {
            setSavingEdit(true);
            setError('');
            setSuccess('');

            const response = await fetch(
                `${USERS_URL}/${editingUser.id}`,
                getRequestOptions(token, {
                    method: 'PUT',
                    body: JSON.stringify({
                        displayName: editForm.displayName,
                        isAdmin: editForm.isAdmin,
                    }),
                })
            );

            if (!response.ok) {
                const body = await response.json().catch(() => null);

                throw new Error(
                    body?.message ||
                    `Failed to update user (${response.status}).`
                );
            }

            const updatedUser: User = await response.json();

            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    user.id === updatedUser.id ? updatedUser : user
                )
            );

            setEditingUser(null);

            setSuccess(
                `${updatedUser.email} was updated successfully.`
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to update user.'
            );
        } finally {
            setSavingEdit(false);
        }
    };

    // ==========================================================
    // CREATE USER
    // ==========================================================

    const resetCreateForm = () => {
        setCreateForm({
            email: '',
            displayName: '',
            password: '',
            isAdmin: false,
        });
    };

    const createUser = async () => {
        if (!createForm.email.trim()) {
            setError('Email is required.');
            return;
        }

        if (!createForm.password) {
            setError('Password is required.');
            return;
        }

        try {
            setCreating(true);
            setError('');
            setSuccess('');

            const response = await fetch(
                USERS_URL,
                getRequestOptions(token, {
                    method: 'POST',
                    body: JSON.stringify({
                        email: createForm.email.trim(),
                        displayName: createForm.displayName.trim(),
                        password: createForm.password,
                        isAdmin: createForm.isAdmin,
                    }),
                })
            );

            if (!response.ok) {
                const body = await response.json().catch(() => null);

                throw new Error(
                    body?.message ||
                    `Failed to create user (${response.status}).`
                );
            }

            const createdUser: User = await response.json();

            setUsers((currentUsers) =>
                [...currentUsers, createdUser].sort((a, b) =>
                    a.email.localeCompare(b.email)
                )
            );

            resetCreateForm();
            setShowCreate(false);

            setSuccess(
                `${createdUser.email} was created successfully.`
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to create user.'
            );
        } finally {
            setCreating(false);
        }
    };

    // ==========================================================
    // DELETE USER
    // ==========================================================

    const deleteUser = async (user: User) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete ${user.email}?\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setDeletingUserId(user.id);
            setError('');
            setSuccess('');

            const response = await fetch(
                `${USERS_URL}/${user.id}`,
                getRequestOptions( token, {
                    method: 'DELETE',
                })
            );

            if (!response.ok) {
                const body = await response.json().catch(() => null);

                throw new Error(
                    body?.message ||
                    `Failed to delete user (${response.status}).`
                );
            }

            setUsers((currentUsers) =>
                currentUsers.filter(
                    (currentUser) => currentUser.id !== user.id
                )
            );

            setSuccess(`${user.email} was deleted.`);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to delete user.'
            );
        } finally {
            setDeletingUserId(null);
        }
    };

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
        <div className="userManagement">
            {/* =====================================================
          HEADER
      ====================================================== */}

            <div className="userManagementHeader">
                <div>
                    <div className="eyebrow">ADMINISTRATION</div>

                    <h1>User Management</h1>

                    <p>
                        Manage PhraseX users, permissions and accounts.
                    </p>
                </div>

                <button
                    type="button"
                    className="gold"
                    onClick={() => {
                        setError('');
                        setSuccess('');
                        setShowCreate(true);
                    }}
                >
                    + Create user
                </button>
            </div>

            {/* =====================================================
          FEEDBACK
      ====================================================== */}

            {error && (
                <div
                    className="userManagementAlert error"
                    role="alert"
                >
                    <strong>Error</strong>
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div
                    className="userManagementAlert success"
                    role="status"
                >
                    {success}
                </div>
            )}

            {/* =====================================================
          FILTERS
      ====================================================== */}

            <div className="userManagementToolbar">
                <div className="userSearch">
                    <span>⌕</span>

                    <input
                        type="search"
                        placeholder="Search by email or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    className="userRoleFilter"
                    value={roleFilter}
                    onChange={(e) =>
                        setRoleFilter(
                            e.target.value as 'all' | 'admin' | 'user'
                        )
                    }
                >
                    <option value="all">All users</option>
                    <option value="admin">Administrators</option>
                    <option value="user">Regular users</option>
                </select>

                <div className="userCount">
                    {filteredUsers.length} of {users.length} users
                </div>
            </div>

            {/* =====================================================
          USER TABLE
      ====================================================== */}

            <div className="userTableContainer">
                {loading ? (
                    <div className="userManagementEmpty">
                        <div className="userSpinner" />
                        <p>Loading users...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="userManagementEmpty">
                        <h3>No users found</h3>

                        <p>
                            {search
                                ? 'Try changing your search.'
                                : 'There are currently no users.'}
                        </p>
                    </div>
                ) : (
                    <table className="userTable">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="userIdentity">
                                            <div className="userAvatar">
                                                {(user.displayName ||
                                                    user.email ||
                                                    '?')
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>

                                            <div>
                                                <strong>
                                                    {user.displayName || 'Unnamed user'}
                                                </strong>

                                                <span className="userId">
                                                    {user.id}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    <td>{user.email}</td>

                                    <td>
                                        {user.isAdmin ? (
                                            <span className="roleBadge admin">
                                                Admin
                                            </span>
                                        ) : (
                                            <span className="roleBadge">
                                                User
                                            </span>
                                        )}
                                    </td>

                                    <td>
                                        <div className="userActions">
                                            <button
                                                type="button"
                                                className="actionButton"
                                                onClick={() => startEditing(user)}
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                className="actionButton danger"
                                                disabled={deletingUserId === user.id}
                                                onClick={() => deleteUser(user)}
                                            >
                                                {deletingUserId === user.id
                                                    ? 'Deleting...'
                                                    : 'Delete'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* =====================================================
          EDIT MODAL
      ====================================================== */}

            {editingUser && (
                <div className="userModalBackdrop">
                    <div className="userModal">
                        <div className="userModalHeader">
                            <div>
                                <div className="eyebrow">EDIT USER</div>
                                <h2>{editingUser.email}</h2>
                            </div>

                            <button
                                type="button"
                                className="modalClose"
                                onClick={cancelEditing}
                            >
                                ×
                            </button>
                        </div>

                        <label>
                            Display name
                            <input
                                type="text"
                                value={editForm.displayName}
                                onChange={(e) =>
                                    setEditForm({
                                        ...editForm,
                                        displayName: e.target.value,
                                    })
                                }
                            />
                        </label>

                        <label className="adminToggle">
                            <span>
                                <strong>Administrator</strong>
                                <small>
                                    Give this user access to admin functionality.
                                </small>
                            </span>

                            <input
                                type="checkbox"
                                checked={editForm.isAdmin}
                                onChange={(e) =>
                                    setEditForm({
                                        ...editForm,
                                        isAdmin: e.target.checked,
                                    })
                                }
                            />
                        </label>

                        <div className="modalActions">
                            <button
                                type="button"
                                className="secondaryButton"
                                onClick={cancelEditing}
                                disabled={savingEdit}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="gold"
                                onClick={saveUser}
                                disabled={savingEdit}
                            >
                                {savingEdit ? 'Saving...' : 'Save changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================
          CREATE USER MODAL
      ====================================================== */}

            {showCreate && (
                <div className="userModalBackdrop">
                    <div className="userModal">
                        <div className="userModalHeader">
                            <div>
                                <div className="eyebrow">NEW ACCOUNT</div>
                                <h2>Create user</h2>
                            </div>

                            <button
                                type="button"
                                className="modalClose"
                                onClick={() => {
                                    if (!creating) {
                                        setShowCreate(false);
                                        resetCreateForm();
                                    }
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <label>
                            Email *
                            <input
                                type="email"
                                value={createForm.email}
                                onChange={(e) =>
                                    setCreateForm({
                                        ...createForm,
                                        email: e.target.value,
                                    })
                                }
                                placeholder="user@example.com"
                            />
                        </label>

                        <label>
                            Display name
                            <input
                                type="text"
                                value={createForm.displayName}
                                onChange={(e) =>
                                    setCreateForm({
                                        ...createForm,
                                        displayName: e.target.value,
                                    })
                                }
                                placeholder="John Smith"
                            />
                        </label>

                        <label>
                            Password *
                            <input
                                type="password"
                                value={createForm.password}
                                onChange={(e) =>
                                    setCreateForm({
                                        ...createForm,
                                        password: e.target.value,
                                    })
                                }
                                placeholder="Password"
                            />
                        </label>

                        <label className="adminToggle">
                            <span>
                                <strong>Administrator</strong>
                                <small>
                                    Create this account with admin permissions.
                                </small>
                            </span>

                            <input
                                type="checkbox"
                                checked={createForm.isAdmin}
                                onChange={(e) =>
                                    setCreateForm({
                                        ...createForm,
                                        isAdmin: e.target.checked,
                                    })
                                }
                            />
                        </label>

                        <div className="modalActions">
                            <button
                                type="button"
                                className="secondaryButton"
                                onClick={() => {
                                    if (!creating) {
                                        setShowCreate(false);
                                        resetCreateForm();
                                    }
                                }}
                                disabled={creating}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="gold"
                                onClick={createUser}
                                disabled={
                                    creating ||
                                    !createForm.email.trim() ||
                                    !createForm.password
                                }
                            >
                                {creating ? 'Creating...' : 'Create user'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}