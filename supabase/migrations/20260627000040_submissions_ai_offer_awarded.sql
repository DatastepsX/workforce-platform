-- AI match score stored on submission
ALTER TABLE candidate_submissions ADD COLUMN IF NOT EXISTS ai_score integer;

-- Awarded status for the award approval flow
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'awarded';

-- Offer flow: supplier can accept or decline an offer
ALTER TABLE candidate_submissions ADD COLUMN IF NOT EXISTS offer_status text
  CHECK (offer_status IN ('pending', 'accepted', 'declined'));
ALTER TABLE candidate_submissions ADD COLUMN IF NOT EXISTS offer_note text;

-- PO number on awards
ALTER TABLE awards ADD COLUMN IF NOT EXISTS po_number text;
