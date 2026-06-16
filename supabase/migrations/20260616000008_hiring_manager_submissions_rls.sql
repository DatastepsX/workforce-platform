-- Allow hiring managers to read submissions for demands they created
CREATE POLICY "hiring_manager_submissions_select"
  ON candidate_submissions FOR SELECT
  USING (
    get_my_role() = 'hiring_manager'
    AND EXISTS (
      SELECT 1 FROM demands
      WHERE id = demand_id AND created_by = auth.uid()
    )
  );
