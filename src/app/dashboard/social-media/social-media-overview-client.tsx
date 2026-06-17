'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import type { SocialPlatform, SocialPostStatus, Demand } from '@/types/database';
import type { PostWithDemand } from './page';
import {
  PLATFORM_MAP,
  STATUS_META,
  generateImage,
} from '@/app/dashboard/demands/[id]/social-media-client';
import {
  updateSocialPostContent,
  approveSocialPost,
  rejectSocialPost,
  reviseSocialPost,
  markSocialPostPosted,
  archiveSocialPost,
  deleteSocialPost,
  regenerateSocialPost,
} from '@/lib/actions/social-posts';

const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'linkedin', 'tiktok'];
const ALL_STATUSES: SocialPostStatus[] = ['draft', 'approved', 'posted', 'rejected', 'archived'];

interface Props {
  posts: PostWithDemand[];
}

export function SocialMediaOverviewClient({ posts: initialPosts }: Props) {
  const [posts, setPosts] = useState(initialPosts);
  const [filterPlatform, setFilterPlatform] = useState<SocialPlatform | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<SocialPostStatus | 'all'>('all');
  const [selectedPost, setSelectedPost] = useState<PostWithDemand | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showPostedModal, setShowPostedModal] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setPosts(initialPosts); }, [initialPosts]);

  useEffect(() => {
    if (!selectedPost) { setImageDataUrl(null); return; }
    setImageLoading(true);
    generateImage(selectedPost, selectedPost.demand as unknown as Demand)
      .then(setImageDataUrl)
      .catch(() => setImageDataUrl(null))
      .finally(() => setImageLoading(false));
  }, [selectedPost]);

  function openPost(post: PostWithDemand) {
    setSelectedPost(post);
    setEditMode(false);
    setEditCaption(post.caption ?? '');
    setEditHashtags(post.hashtags.join(' '));
    setImageDataUrl(null);
  }

  function closeModal() {
    setSelectedPost(null);
    setEditMode(false);
    setImageDataUrl(null);
  }

  function updateLocal(postId: string, patch: Partial<PostWithDemand>) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...patch } : p));
    if (selectedPost?.id === postId) setSelectedPost(prev => prev ? { ...prev, ...patch } : prev);
  }

  async function handleSaveEdit() {
    if (!selectedPost) return;
    const tags = editHashtags.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);
    startTransition(async () => {
      await updateSocialPostContent(selectedPost.id, selectedPost.demand_id, editCaption, tags);
      updateLocal(selectedPost.id, { caption: editCaption, hashtags: tags });
      setEditMode(false);
    });
  }

  async function handleApprove() {
    if (!selectedPost) return;
    startTransition(async () => {
      await approveSocialPost(selectedPost.id, selectedPost.demand_id);
      updateLocal(selectedPost.id, { status: 'approved' });
    });
  }

  async function handleReject() {
    if (!selectedPost) return;
    startTransition(async () => {
      await rejectSocialPost(selectedPost.id, selectedPost.demand_id);
      updateLocal(selectedPost.id, { status: 'rejected' });
    });
  }

  async function handleRevise() {
    if (!selectedPost) return;
    startTransition(async () => {
      await reviseSocialPost(selectedPost.id, selectedPost.demand_id);
      updateLocal(selectedPost.id, { status: 'draft' });
    });
  }

  async function handleMarkPosted() {
    if (!selectedPost) return;
    startTransition(async () => {
      await markSocialPostPosted(selectedPost.id, selectedPost.demand_id, externalUrl || undefined);
      updateLocal(selectedPost.id, { status: 'posted', external_post_url: externalUrl || null, posted_at: new Date().toISOString() });
      setShowPostedModal(false);
      setExternalUrl('');
    });
  }

  async function handleArchive() {
    if (!selectedPost) return;
    startTransition(async () => {
      await archiveSocialPost(selectedPost.id, selectedPost.demand_id);
      updateLocal(selectedPost.id, { status: 'archived' });
    });
  }

  async function handleDelete() {
    if (!selectedPost) return;
    if (!confirm('Diesen Post löschen?')) return;
    startTransition(async () => {
      await deleteSocialPost(selectedPost.id, selectedPost.demand_id);
      setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
      closeModal();
    });
  }

  async function handleRegenerate() {
    if (!selectedPost) return;
    startTransition(async () => {
      await regenerateSocialPost(selectedPost.id, selectedPost.demand_id);
      setEditMode(false);
    });
  }

  function handleCopy() {
    if (!selectedPost) return;
    const hashtags = selectedPost.hashtags.map(h => `#${h}`).join(' ');
    const text = [
      selectedPost.caption ?? '',
      '',
      hashtags,
      selectedPost.platform !== 'instagram' ? (selectedPost.tracking_url ?? '') : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
  }

  function handleDownload() {
    if (!imageDataUrl || !selectedPost) return;
    const a = document.createElement('a');
    a.href = imageDataUrl;
    const pl = PLATFORM_MAP[selectedPost.platform];
    a.download = `workforcex-${pl?.label.toLowerCase() ?? 'post'}-${selectedPost.tracking_code}.png`;
    a.click();
  }

  // Stats
  const statusCounts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = posts.filter(p => p.status === s).length;
    return acc;
  }, {});

  // Filtered posts
  const filtered = posts.filter(p => {
    if (filterPlatform !== 'all' && p.platform !== filterPlatform) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const post = selectedPost;

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {ALL_STATUSES.map(s => {
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={`bg-white rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] text-left transition-all ${filterStatus === s ? 'ring-2' : 'hover:shadow-md'}`}
              style={filterStatus === s ? { ringColor: meta.color } as React.CSSProperties : {}}
            >
              <p className="text-[24px] font-bold text-black mb-0.5">{statusCounts[s] ?? 0}</p>
              <p className="text-[12px] font-semibold" style={{ color: meta.color }}>{meta.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterPlatform('all')}
          className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${filterPlatform === 'all' ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'}`}
        >
          Alle Plattformen
        </button>
        {ALL_PLATFORMS.map(pid => {
          const pl = PLATFORM_MAP[pid];
          return (
            <button
              key={pid}
              onClick={() => setFilterPlatform(filterPlatform === pid ? 'all' : pid)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${filterPlatform === pid ? 'text-white' : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'}`}
              style={filterPlatform === pid ? { backgroundColor: pl?.color } : {}}
            >
              <span style={{ color: filterPlatform === pid ? '#fff' : pl?.color }}>{pl?.icon}</span>
              {pl?.label}
            </button>
          );
        })}

        <div className="w-px h-5 bg-[#E5E5EA] mx-1" />

        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${filterStatus === 'all' ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'}`}
        >
          Alle Status
        </button>
        {ALL_STATUSES.map(s => {
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all ${filterStatus === s ? '' : 'opacity-70 hover:opacity-100'}`}
              style={filterStatus === s
                ? { backgroundColor: meta.bg, color: meta.color, outline: `2px solid ${meta.color}` }
                : { backgroundColor: meta.bg, color: meta.color }}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[16px] font-semibold text-black mb-1">Keine Posts gefunden</p>
          <p className="text-[14px] text-[#8E8E93]">Posts werden in der jeweiligen Demand-Detailseite erstellt (Kanal: Career Portal).</p>
        </div>
      )}

      {/* Posts grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const meta = STATUS_META[p.status];
            const pl = PLATFORM_MAP[p.platform];
            return (
              <button
                key={p.id}
                onClick={() => openPost(p)}
                className="text-left bg-white rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_16px_rgba(0,0,0,0.10)] transition-shadow"
              >
                {/* Platform + status */}
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="flex items-center gap-1.5 text-[13px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ color: pl?.color ?? '#000', backgroundColor: (pl?.color ?? '#000') + '18' }}
                  >
                    <span style={{ color: pl?.color ?? '#000' }}>{pl?.icon}</span>
                    {pl?.label}
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: meta.color, backgroundColor: meta.bg }}
                  >
                    {meta.label}
                  </span>
                </div>

                {/* Demand link */}
                <Link
                  href={`/dashboard/demands/${p.demand_id}`}
                  onClick={e => e.stopPropagation()}
                  className="block text-[12px] font-medium text-[#007AFF] truncate mb-2 hover:underline"
                >
                  {p.demand.title}
                </Link>

                {/* Caption preview */}
                <p className="text-[13px] text-[#3C3C43] leading-relaxed line-clamp-3">
                  {p.caption ?? '—'}
                </p>

                {/* Hashtags */}
                {p.hashtags.length > 0 && (
                  <p className="text-[12px] text-[#8E8E93] mt-2 truncate">
                    {p.hashtags.slice(0, 4).map(h => `#${h}`).join(' ')}
                    {p.hashtags.length > 4 && ` +${p.hashtags.length - 4}`}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F2F2F7]">
                  <span className="text-[11px] text-[#8E8E93] font-mono">{p.tracking_code}</span>
                  <span className="text-[11px] text-[#8E8E93]">
                    {new Date(p.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Post detail modal */}
      {post && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[3px]" onClick={closeModal}>
          <div
            className="bg-white w-full sm:rounded-3xl sm:max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-6 pt-5 pb-4 border-b border-[#F2F2F7] flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ color: PLATFORM_MAP[post.platform]?.color, backgroundColor: (PLATFORM_MAP[post.platform]?.color ?? '#000') + '18' }}
                >
                  {PLATFORM_MAP[post.platform]?.icon}
                  {PLATFORM_MAP[post.platform]?.label}
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ color: STATUS_META[post.status].color, backgroundColor: STATUS_META[post.status].bg }}
                >
                  {STATUS_META[post.status].label}
                </span>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#8E8E93] hover:text-black transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: content */}
              <div className="space-y-5">
                {/* Demand link */}
                <div>
                  <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Demand</p>
                  <Link href={`/dashboard/demands/${post.demand_id}`} className="text-[14px] font-semibold text-[#007AFF] hover:underline">
                    {post.demand.title}
                    {post.demand.location && <span className="text-[#8E8E93] font-normal ml-1">· {post.demand.location}</span>}
                  </Link>
                </div>

                {/* Caption */}
                <div>
                  <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">Caption</p>
                  {editMode ? (
                    <textarea
                      value={editCaption}
                      onChange={e => setEditCaption(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5EA] text-[14px] text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF] resize-none"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-[14px] text-[#3C3C43] leading-relaxed font-sans bg-[#F2F2F7] rounded-xl p-4">
                      {post.caption ?? '—'}
                    </pre>
                  )}
                </div>

                {/* Hashtags */}
                <div>
                  <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-2">Hashtags</p>
                  {editMode ? (
                    <input
                      value={editHashtags}
                      onChange={e => setEditHashtags(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5EA] text-[14px] text-black focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                      placeholder="#tag1 #tag2 ..."
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {post.hashtags.map(h => (
                        <span key={h} className="text-[12px] font-medium text-[#007AFF] bg-[#007AFF]/8 px-2.5 py-0.5 rounded-full">
                          #{h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tracking */}
                {post.tracking_url && (
                  <div>
                    <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Tracking URL</p>
                    <p className="text-[13px] text-[#3C3C43] font-mono break-all">{post.tracking_url}</p>
                  </div>
                )}

                {/* Posted URL */}
                {post.external_post_url && (
                  <div>
                    <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Post URL</p>
                    <a href={post.external_post_url} target="_blank" rel="noopener noreferrer"
                      className="text-[13px] text-[#007AFF] hover:underline break-all">
                      {post.external_post_url}
                    </a>
                  </div>
                )}
              </div>

              {/* Right: image preview */}
              <div className="space-y-4">
                <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide">Bild-Vorschau</p>
                <div className="aspect-square rounded-2xl overflow-hidden bg-[#0D1B2A] flex items-center justify-center">
                  {imageLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                      <p className="text-[13px] text-white/50">Bild wird generiert…</p>
                    </div>
                  ) : imageDataUrl ? (
                    <img src={imageDataUrl} alt="Post preview" className="w-full h-full object-cover" />
                  ) : (
                    <p className="text-[13px] text-white/30">Kein Vorschaubild</p>
                  )}
                </div>

                {imageDataUrl && (
                  <button
                    onClick={handleDownload}
                    className="w-full py-2.5 rounded-xl border border-[#E5E5EA] text-[14px] font-medium text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    Bild herunterladen
                  </button>
                )}

                <button
                  onClick={handleCopy}
                  className="w-full py-2.5 rounded-xl border border-[#E5E5EA] text-[14px] font-medium text-[#3C3C43] hover:bg-[#F2F2F7] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                  Caption + Hashtags kopieren
                </button>
              </div>
            </div>

            {/* Action bar */}
            <div className="px-6 pb-6 pt-2 border-t border-[#F2F2F7] flex flex-wrap gap-2">
              {editMode ? (
                <>
                  <button onClick={handleSaveEdit} disabled={isPending}
                    className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-white disabled:opacity-40 transition-opacity"
                    style={{ backgroundColor: '#007AFF' }}>
                    {isPending ? 'Speichern…' : 'Speichern'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-[#8E8E93] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors">
                    Abbrechen
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditMode(true)}
                    className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-[#3C3C43] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors">
                    Bearbeiten
                  </button>
                  <button onClick={handleRegenerate} disabled={isPending}
                    className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-[#3C3C43] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors disabled:opacity-40">
                    Neu generieren
                  </button>

                  {post.status === 'draft' && (
                    <button onClick={handleApprove} disabled={isPending}
                      className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-white disabled:opacity-40 transition-opacity"
                      style={{ backgroundColor: '#007AFF' }}>
                      Freigeben
                    </button>
                  )}
                  {post.status === 'approved' && (
                    <>
                      <button onClick={() => setShowPostedModal(true)}
                        className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-white"
                        style={{ backgroundColor: '#34C759' }}>
                        Als gepostet markieren
                      </button>
                      <button onClick={handleReject} disabled={isPending}
                        className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-[#FF3B30] bg-[#FF3B30]/8 hover:bg-[#FF3B30]/15 transition-colors">
                        Ablehnen
                      </button>
                    </>
                  )}
                  {post.status === 'rejected' && (
                    <button onClick={handleRevise} disabled={isPending}
                      className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-[#FF9500] bg-[#FF9500]/8 hover:bg-[#FF9500]/15 transition-colors">
                      Überarbeiten (→ Entwurf)
                    </button>
                  )}

                  {post.status !== 'archived' && post.status !== 'posted' && (
                    <button onClick={handleArchive} disabled={isPending}
                      className="px-4 py-2 rounded-[10px] text-[14px] font-semibold text-[#8E8E93] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors">
                      Archivieren
                    </button>
                  )}

                  <button onClick={handleDelete} disabled={isPending}
                    className="ml-auto px-4 py-2 rounded-[10px] text-[14px] font-semibold text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors">
                    Löschen
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark as posted sub-modal */}
      {showPostedModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-[17px] font-bold text-black mb-1">Post veröffentlicht?</h3>
            <p className="text-[14px] text-[#8E8E93] mb-4">Optional: Link zum veröffentlichten Post angeben.</p>
            <input
              value={externalUrl}
              onChange={e => setExternalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5EA] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowPostedModal(false); setExternalUrl(''); }}
                className="flex-1 py-2.5 rounded-xl text-[15px] font-semibold text-[#8E8E93] bg-[#F2F2F7]">
                Abbrechen
              </button>
              <button onClick={handleMarkPosted} disabled={isPending}
                className="flex-1 py-2.5 rounded-xl text-[15px] font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: '#34C759' }}>
                {isPending ? 'Speichern…' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
