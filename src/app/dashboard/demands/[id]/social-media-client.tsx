'use client';

import { useState, useEffect, useTransition } from 'react';
import type { SocialPost, SocialPlatform, SocialPostStatus, Demand } from '@/types/database';
import {
  generateSocialPosts,
  updateSocialPostContent,
  approveSocialPost,
  rejectSocialPost,
  reviseSocialPost,
  markSocialPostPosted,
  archiveSocialPost,
  deleteSocialPost,
  regenerateSocialPost,
} from '@/lib/actions/social-posts';

/* ─── Platform meta ─────────────────────────────────────── */

const PLATFORMS: { id: SocialPlatform; label: string; icon: JSX.Element; color: string }[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    color: '#E1306C',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: '#010101',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
      </svg>
    ),
  },
];

const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map(p => [p.id, p]));

/* ─── Status meta ────────────────────────────────────────── */

const STATUS_META: Record<SocialPostStatus, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Entwurf',    color: '#8E8E93', bg: '#8E8E9318' },
  approved: { label: 'Freigegeben', color: '#007AFF', bg: '#007AFF18' },
  posted:   { label: 'Gepostet',   color: '#34C759', bg: '#34C75918' },
  archived: { label: 'Archiviert', color: '#636366', bg: '#63636618' },
  rejected: { label: 'Abgelehnt', color: '#FF3B30', bg: '#FF3B3018' },
};

/* ─── Canvas image generator ─────────────────────────────── */

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

async function generateImage(post: SocialPost, demand: Demand): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 1080, 1080);

  // Header band
  ctx.fillStyle = '#007AFF';
  ctx.fillRect(0, 0, 1080, 90);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
  ctx.fillText('WorkforceX', 50, 57);

  // Platform badge in header (top right)
  const platform = PLATFORM_MAP[post.platform];
  if (platform) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    const badgeW = 140;
    ctx.roundRect(1080 - badgeW - 20, 18, badgeW, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(platform.label, 1080 - 20 - badgeW / 2, 50);
    ctx.textAlign = 'left';
  }

  // Job title
  ctx.fillStyle = '#1C1C1E';
  ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
  let nextY = wrapText(ctx, demand.title, 50, 175, 960, 66);

  // Location + contract pills
  nextY += 16;
  const tags: { text: string; color: string }[] = [];
  if (demand.location) tags.push({ text: demand.location, color: '#34C759' });
  if (demand.remote_allowed) tags.push({ text: 'Remote', color: '#007AFF' });
  tags.push({ text: demand.contract_type.charAt(0).toUpperCase() + demand.contract_type.slice(1), color: '#8E8E93' });

  ctx.font = '20px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
  let tagX = 50;
  for (const tag of tags) {
    const w = ctx.measureText(tag.text).width + 24;
    ctx.fillStyle = tag.color + '22';
    ctx.beginPath();
    ctx.roundRect(tagX, nextY - 22, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = tag.color;
    ctx.fillText(tag.text, tagX + 12, nextY);
    tagX += w + 10;
  }
  nextY += 28;

  // Separator
  nextY += 12;
  ctx.fillStyle = '#E5E5EA';
  ctx.fillRect(50, nextY, 980, 2);
  nextY += 20;

  // Budget + start date
  const facts: string[] = [];
  if (demand.budget_max) facts.push(`💰 bis zu €${demand.budget_max.toLocaleString('de-DE')}`);
  else if (demand.budget_min) facts.push(`💰 ab €${demand.budget_min.toLocaleString('de-DE')}`);
  if (demand.start_date) {
    facts.push(`📅 Start: ${new Date(demand.start_date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`);
  }
  if (facts.length) {
    ctx.fillStyle = '#3C3C43';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
    ctx.fillText(facts.join('   ·   '), 50, nextY + 22);
    nextY += 50;
  }

  // Skills chips
  if (demand.skills.length > 0) {
    nextY += 10;
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
    let sx = 50;
    let sy = nextY;
    for (const skill of demand.skills.slice(0, 7)) {
      const w = ctx.measureText(skill).width + 24;
      if (sx + w > 980) { sx = 50; sy += 40; }
      ctx.fillStyle = '#007AFF18';
      ctx.beginPath();
      ctx.roundRect(sx, sy - 20, w, 32, 8);
      ctx.fill();
      ctx.fillStyle = '#007AFF';
      ctx.fillText(skill, sx + 12, sy);
      sx += w + 10;
    }
    nextY = sy + 40;
  }

  // Description snippet
  if (demand.description) {
    nextY += 10;
    ctx.fillStyle = '#636366';
    ctx.font = '21px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
    const snippet = demand.description.length > 180 ? demand.description.slice(0, 177) + '…' : demand.description;
    wrapText(ctx, snippet, 50, nextY, 680, 30);
    nextY += 80;
  }

  // Footer area
  ctx.fillStyle = '#F5F5F7';
  ctx.fillRect(0, 840, 1080, 200);

  // CTA text
  ctx.fillStyle = '#1C1C1E';
  ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
  ctx.fillText('Jetzt bewerben!', 50, 895);
  ctx.fillStyle = '#8E8E93';
  ctx.font = '18px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
  const trackingUrl = post.tracking_url ?? '';
  const displayUrl = trackingUrl.length > 55 ? trackingUrl.slice(0, 52) + '…' : trackingUrl;
  ctx.fillText(displayUrl, 50, 930);

  // QR code
  if (trackingUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(trackingUrl, { margin: 1, width: 210, color: { dark: '#1C1C1E', light: '#F5F5F7' } });
      const qrImg = new Image();
      await new Promise<void>(resolve => { qrImg.onload = () => resolve(); qrImg.src = qrDataUrl; });
      ctx.drawImage(qrImg, 855, 845, 200, 200);
    } catch { /* skip QR if error */ }
  }

  // Bottom bar
  ctx.fillStyle = '#007AFF';
  ctx.fillRect(0, 1040, 1080, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`workforce-platform-omega.vercel.app  ·  ref: ${post.tracking_code}`, 540, 1066);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

/* ─── Component ──────────────────────────────────────────── */

interface Props {
  posts: SocialPost[];
  demand: Demand;
  canEdit: boolean;
}

export function SocialMediaClient({ posts: initialPosts, demand, canEdit }: Props) {
  const [posts, setPosts] = useState(initialPosts);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram', 'linkedin']);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showPostedModal, setShowPostedModal] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [isPending, startTransition] = useTransition();

  // Keep local posts in sync with server after server action
  useEffect(() => { setPosts(initialPosts); }, [initialPosts]);

  // Generate canvas image when modal opens
  useEffect(() => {
    if (!selectedPost) { setImageDataUrl(null); return; }
    setImageLoading(true);
    generateImage(selectedPost, demand)
      .then(setImageDataUrl)
      .catch(() => setImageDataUrl(null))
      .finally(() => setImageLoading(false));
  }, [selectedPost, demand]);

  function openPost(post: SocialPost) {
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

  function updateLocal(postId: string, patch: Partial<SocialPost>) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...patch } : p));
    if (selectedPost?.id === postId) setSelectedPost(prev => prev ? { ...prev, ...patch } : prev);
  }

  async function handleGenerate() {
    if (!selectedPlatforms.length) return;
    startTransition(async () => {
      await generateSocialPosts(demand.id, selectedPlatforms);
      setShowGenerateModal(false);
    });
  }

  async function handleSaveEdit() {
    if (!selectedPost) return;
    const tags = editHashtags.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);
    startTransition(async () => {
      await updateSocialPostContent(selectedPost.id, demand.id, editCaption, tags);
      updateLocal(selectedPost.id, { caption: editCaption, hashtags: tags });
      setEditMode(false);
    });
  }

  async function handleApprove() {
    if (!selectedPost) return;
    startTransition(async () => {
      await approveSocialPost(selectedPost.id, demand.id);
      updateLocal(selectedPost.id, { status: 'approved' });
    });
  }

  async function handleReject() {
    if (!selectedPost) return;
    startTransition(async () => {
      await rejectSocialPost(selectedPost.id, demand.id);
      updateLocal(selectedPost.id, { status: 'rejected' });
    });
  }

  async function handleRevise() {
    if (!selectedPost) return;
    startTransition(async () => {
      await reviseSocialPost(selectedPost.id, demand.id);
      updateLocal(selectedPost.id, { status: 'draft' });
    });
  }

  async function handleMarkPosted() {
    if (!selectedPost) return;
    startTransition(async () => {
      await markSocialPostPosted(selectedPost.id, demand.id, externalUrl || undefined);
      updateLocal(selectedPost.id, { status: 'posted', external_post_url: externalUrl || null, posted_at: new Date().toISOString() });
      setShowPostedModal(false);
      setExternalUrl('');
    });
  }

  async function handleArchive() {
    if (!selectedPost) return;
    startTransition(async () => {
      await archiveSocialPost(selectedPost.id, demand.id);
      updateLocal(selectedPost.id, { status: 'archived' });
    });
  }

  async function handleDelete() {
    if (!selectedPost) return;
    if (!confirm('Diesen Post löschen?')) return;
    startTransition(async () => {
      await deleteSocialPost(selectedPost.id, demand.id);
      setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
      closeModal();
    });
  }

  async function handleRegenerate() {
    if (!selectedPost) return;
    startTransition(async () => {
      await regenerateSocialPost(selectedPost.id, demand.id);
      // Refresh handled by revalidatePath — just close edit mode
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
    if (!imageDataUrl) return;
    const a = document.createElement('a');
    a.href = imageDataUrl;
    const platformLabel = PLATFORM_MAP[selectedPost!.platform]?.label ?? 'post';
    a.download = `workforcex-${platformLabel.toLowerCase()}-${selectedPost!.tracking_code}.png`;
    a.click();
  }

  const activePosts = posts.filter(p => p.status !== 'archived');
  const archivedPosts = posts.filter(p => p.status === 'archived');

  // Platforms already generated (avoid duplicates)
  const existingPlatforms = new Set(activePosts.map(p => p.platform));

  const post = selectedPost; // alias for JSX

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[14px] text-[#8E8E93]">
            {activePosts.length} {activePosts.length === 1 ? 'Post' : 'Posts'} erstellt
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[14px] font-semibold text-white transition-opacity"
            style={{ backgroundColor: '#007AFF' }}
            disabled={isPending}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Post generieren
          </button>
        )}
      </div>

      {/* Empty state */}
      {posts.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="w-14 h-14 rounded-full bg-[#007AFF]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#007AFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2H3v16h5l3 3 3-3h7V2z"/><path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <p className="text-[16px] font-semibold text-black mb-1">Noch keine Social-Media-Posts</p>
          <p className="text-[14px] text-[#8E8E93] mb-5">Erstelle Posts für Instagram, LinkedIn, Facebook und TikTok.</p>
          {canEdit && (
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-5 py-2.5 rounded-[10px] text-[15px] font-semibold text-white"
              style={{ backgroundColor: '#007AFF' }}
            >
              Posts generieren
            </button>
          )}
        </div>
      )}

      {/* Card grid */}
      {activePosts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {activePosts.map(p => {
            const meta = STATUS_META[p.status];
            const pl = PLATFORM_MAP[p.platform];
            return (
              <button
                key={p.id}
                onClick={() => openPost(p)}
                className="text-left bg-white rounded-2xl p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_16px_rgba(0,0,0,0.10)] transition-shadow"
              >
                {/* Platform + status */}
                <div className="flex items-center justify-between mb-3">
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

                {/* Caption preview */}
                <p className="text-[13px] text-[#3C3C43] leading-relaxed line-clamp-3">
                  {p.caption ?? '—'}
                </p>

                {/* Hashtags preview */}
                {p.hashtags.length > 0 && (
                  <p className="text-[12px] text-[#8E8E93] mt-2 truncate">
                    {p.hashtags.slice(0, 4).map(h => `#${h}`).join(' ')}
                    {p.hashtags.length > 4 && ` +${p.hashtags.length - 4}`}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F2F2F7]">
                  <span className="text-[11px] text-[#8E8E93] font-mono">{p.tracking_code}</span>
                  {p.posted_at && (
                    <span className="text-[11px] text-[#34C759]">
                      {new Date(p.posted_at).toLocaleDateString('de-DE')}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Archived posts (collapsed) */}
      {archivedPosts.length > 0 && (
        <details className="mt-4">
          <summary className="text-[13px] text-[#8E8E93] cursor-pointer hover:text-black transition-colors">
            {archivedPosts.length} archivierte {archivedPosts.length === 1 ? 'Post' : 'Posts'} anzeigen
          </summary>
          <div className="grid grid-cols-2 gap-3 mt-3 opacity-60">
            {archivedPosts.map(p => {
              const pl = PLATFORM_MAP[p.platform];
              return (
                <button key={p.id} onClick={() => openPost(p)}
                  className="text-left bg-white rounded-2xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold mb-2"
                    style={{ color: pl?.color ?? '#000' }}>
                    {pl?.icon} {pl?.label}
                  </div>
                  <p className="text-[13px] text-[#8E8E93] line-clamp-2">{p.caption ?? '—'}</p>
                </button>
              );
            })}
          </div>
        </details>
      )}

      {/* Generate modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-[19px] font-bold text-black mb-1">Posts generieren</h3>
              <p className="text-[14px] text-[#8E8E93]">Plattformen für &bdquo;{demand.title}&ldquo; auswählen</p>
            </div>
            <div className="px-6 pb-2 space-y-2">
              {PLATFORMS.map(pl => {
                const isExisting = existingPlatforms.has(pl.id);
                const isSelected = selectedPlatforms.includes(pl.id);
                return (
                  <label key={pl.id} className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${isExisting ? 'opacity-40 cursor-not-allowed border-transparent' : isSelected ? 'border-[#007AFF] bg-[#007AFF]/5' : 'border-transparent hover:border-[#E5E5EA]'}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      disabled={isExisting}
                      onChange={e => {
                        if (isExisting) return;
                        setSelectedPlatforms(prev => e.target.checked ? [...prev, pl.id] : prev.filter(x => x !== pl.id));
                      }}
                    />
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ color: pl.color, backgroundColor: pl.color + '18' }}>
                      {pl.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-[15px] font-semibold text-black">{pl.label}</p>
                      {isExisting && <p className="text-[12px] text-[#8E8E93]">Bereits erstellt</p>}
                    </div>
                    {isSelected && !isExisting && (
                      <div className="w-5 h-5 rounded-full bg-[#007AFF] flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-4">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-[#8E8E93] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleGenerate}
                disabled={isPending || selectedPlatforms.filter(p => !existingPlatforms.has(p)).length === 0}
                className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: '#007AFF' }}
              >
                {isPending ? 'Generiere…' : `${selectedPlatforms.filter(p => !existingPlatforms.has(p)).length} Posts erstellen`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post detail modal */}
      {post && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]" onClick={closeModal}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 bg-white rounded-t-3xl px-6 pt-5 pb-4 border-b border-[#F2F2F7] flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[14px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ color: PLATFORM_MAP[post.platform]?.color, backgroundColor: (PLATFORM_MAP[post.platform]?.color ?? '#000') + '18' }}>
                  {PLATFORM_MAP[post.platform]?.icon}
                  {PLATFORM_MAP[post.platform]?.label}
                </div>
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: STATUS_META[post.status].color, backgroundColor: STATUS_META[post.status].bg }}>
                  {STATUS_META[post.status].label}
                </span>
              </div>
              <button onClick={closeModal} className="p-2 rounded-full text-[#8E8E93] hover:text-black hover:bg-[#F2F2F7] transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Image preview */}
              <div className="rounded-2xl overflow-hidden bg-[#F2F2F7] aspect-square flex items-center justify-center">
                {imageLoading ? (
                  <svg className="w-8 h-8 animate-spin text-[#8E8E93]" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="3"/>
                    <path d="M4 12a8 8 0 018-8" stroke="#007AFF" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                ) : imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageDataUrl} alt="Post preview" className="w-full h-full object-cover" />
                ) : (
                  <p className="text-[13px] text-[#8E8E93]">Vorschau wird geladen…</p>
                )}
              </div>

              {/* Caption */}
              <div>
                <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Caption</p>
                {editMode ? (
                  <textarea
                    value={editCaption}
                    onChange={e => setEditCaption(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E5EA] text-[14px] text-black leading-relaxed focus:outline-none focus:border-[#007AFF] resize-none"
                  />
                ) : (
                  <p className="text-[14px] text-black leading-relaxed whitespace-pre-wrap bg-[#F5F5F7] rounded-xl px-4 py-3">
                    {post.caption ?? '—'}
                  </p>
                )}
              </div>

              {/* Hashtags */}
              <div>
                <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Hashtags</p>
                {editMode ? (
                  <input
                    value={editHashtags}
                    onChange={e => setEditHashtags(e.target.value)}
                    placeholder="#hiring #jobs …"
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E5EA] text-[14px] focus:outline-none focus:border-[#007AFF]"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {post.hashtags.map(h => (
                      <span key={h} className="text-[13px] text-[#007AFF] bg-[#007AFF]/8 px-2.5 py-1 rounded-full font-medium">
                        #{h}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tracking */}
              <div>
                <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Tracking-URL</p>
                <p className="text-[13px] text-[#3C3C43] font-mono bg-[#F5F5F7] rounded-xl px-4 py-3 break-all">
                  {post.tracking_url ?? '—'}
                </p>
              </div>

              {/* External post URL (if posted) */}
              {post.external_post_url && (
                <div>
                  <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-[0.6px] mb-2">Link zum Post</p>
                  <a href={post.external_post_url} target="_blank" rel="noopener noreferrer"
                    className="text-[13px] text-[#007AFF] underline break-all">{post.external_post_url}</a>
                </div>
              )}

              {/* Edit action buttons */}
              {canEdit && editMode && (
                <div className="flex gap-3">
                  <button onClick={() => setEditMode(false)} className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-[#8E8E93] bg-[#F2F2F7]">
                    Abbrechen
                  </button>
                  <button onClick={handleSaveEdit} disabled={isPending} className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-white disabled:opacity-40" style={{ backgroundColor: '#007AFF' }}>
                    Speichern
                  </button>
                </div>
              )}

              {/* Main action buttons */}
              {canEdit && !editMode && (
                <div className="space-y-2">
                  {/* Primary actions */}
                  <div className="flex gap-2">
                    {(post.status === 'draft' || post.status === 'rejected') && (
                      <button onClick={handleApprove} disabled={isPending}
                        className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-white disabled:opacity-40"
                        style={{ backgroundColor: '#007AFF' }}>
                        Freigeben
                      </button>
                    )}
                    {post.status === 'approved' && (
                      <>
                        <button onClick={() => setShowPostedModal(true)} disabled={isPending}
                          className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-white disabled:opacity-40"
                          style={{ backgroundColor: '#34C759' }}>
                          Als gepostet markieren
                        </button>
                        <button onClick={handleReject} disabled={isPending}
                          className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-[#FF3B30] bg-[#FF3B30]/10 disabled:opacity-40">
                          Ablehnen
                        </button>
                      </>
                    )}
                    {post.status === 'rejected' && (
                      <button onClick={handleRevise} disabled={isPending}
                        className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-[#007AFF] bg-[#007AFF]/10 disabled:opacity-40">
                        Zur Überarbeitung
                      </button>
                    )}
                  </div>

                  {/* Secondary actions */}
                  <div className="flex gap-2">
                    <button onClick={() => { setEditMode(true); setEditCaption(post.caption ?? ''); setEditHashtags(post.hashtags.join(' ')); }}
                      className="flex-1 py-2.5 rounded-[12px] text-[14px] font-semibold text-[#3C3C43] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors">
                      Bearbeiten
                    </button>
                    <button onClick={handleRegenerate} disabled={isPending}
                      className="flex-1 py-2.5 rounded-[12px] text-[14px] font-semibold text-[#3C3C43] bg-[#F2F2F7] hover:bg-[#E5E5EA] transition-colors disabled:opacity-40">
                      Neu generieren
                    </button>
                  </div>

                  {/* Copy + Download */}
                  <div className="flex gap-2">
                    <button onClick={handleCopy}
                      className="flex-1 py-2.5 rounded-[12px] text-[14px] font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 transition-colors">
                      Text kopieren
                    </button>
                    <button onClick={handleDownload} disabled={!imageDataUrl}
                      className="flex-1 py-2.5 rounded-[12px] text-[14px] font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 transition-colors disabled:opacity-40">
                      Bild herunterladen
                    </button>
                  </div>

                  {/* Archive + Delete */}
                  {post.status !== 'archived' && (
                    <button onClick={handleArchive} disabled={isPending}
                      className="w-full py-2.5 rounded-[12px] text-[14px] font-semibold text-[#8E8E93] hover:text-black hover:bg-[#F2F2F7] transition-colors">
                      Archivieren
                    </button>
                  )}
                  <button onClick={handleDelete} disabled={isPending}
                    className="w-full py-2.5 rounded-[12px] text-[14px] font-semibold text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors">
                    Löschen
                  </button>
                </div>
              )}

              {/* Copy/Download for view-only */}
              {!canEdit && (
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex-1 py-2.5 rounded-[12px] text-[14px] font-semibold text-[#007AFF] bg-[#007AFF]/10">
                    Text kopieren
                  </button>
                  <button onClick={handleDownload} disabled={!imageDataUrl} className="flex-1 py-2.5 rounded-[12px] text-[14px] font-semibold text-[#007AFF] bg-[#007AFF]/10 disabled:opacity-40">
                    Bild herunterladen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark posted modal */}
      {showPostedModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-[18px] font-bold text-black mb-1">Als gepostet markieren</h3>
            <p className="text-[14px] text-[#8E8E93] mb-4">Optional: Link zum veröffentlichten Post angeben.</p>
            <input
              type="url"
              value={externalUrl}
              onChange={e => setExternalUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/…"
              className="w-full px-4 py-3 rounded-xl border border-[#E5E5EA] text-[14px] focus:outline-none focus:border-[#007AFF] mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowPostedModal(false); setExternalUrl(''); }}
                className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-[#8E8E93] bg-[#F2F2F7]">
                Abbrechen
              </button>
              <button onClick={handleMarkPosted} disabled={isPending}
                className="flex-1 py-3 rounded-[12px] text-[15px] font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: '#34C759' }}>
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
