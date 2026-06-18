'use client';

import { useState } from 'react';
import type { CandidateProfile, SoftSkillRating } from '@/types/database';
import { ProfileForm } from './profile-form';
import { AvatarSection } from './avatar-section';

interface Props {
  userId: string;
  displayName: string;
  userEmail: string;
  profile: CandidateProfile | null;
  cvSignedUrl: string | null;
  softSkillRatings: SoftSkillRating[];
}

export function ProfilePageTabs({ userId, displayName, userEmail, profile, cvSignedUrl, softSkillRatings }: Props) {
  const [tab, setTab] = useState<'profil' | 'kompetenzen'>('profil');

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 bg-[#F2F2F7] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('profil')}
          className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${tab === 'profil' ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
        >
          Mein Profil
        </button>
        <button
          onClick={() => setTab('kompetenzen')}
          className={`relative px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${tab === 'kompetenzen' ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93] hover:text-black'}`}
        >
          Kompetenzprofil
          {profile?.avatar_status === 'ready' && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#5856D6]" />
          )}
        </button>
      </div>

      {tab === 'profil' && (
        <ProfileForm
          userId={userId}
          userName={displayName}
          userEmail={userEmail}
          initialProfile={profile}
          initialCvSignedUrl={cvSignedUrl}
        />
      )}

      {tab === 'kompetenzen' && !profile && (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[16px] font-semibold text-black mb-1">Profil noch nicht ausgefüllt</p>
          <p className="text-[14px] text-[#8E8E93] mb-4">Bitte zuerst das Profil vervollständigen, um das Kompetenzprofil zu aktivieren.</p>
          <button
            onClick={() => setTab('profil')}
            className="px-5 h-10 rounded-2xl text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#007AFF' }}
          >
            Zum Profil
          </button>
        </div>
      )}

      {tab === 'kompetenzen' && profile && (
        <AvatarSection profile={profile} softSkillRatings={softSkillRatings} />
      )}
    </div>
  );
}
