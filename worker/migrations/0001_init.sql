CREATE TABLE votes(exp TEXT NOT NULL, voter TEXT NOT NULL, kind TEXT NOT NULL, garden TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(exp,voter,kind,garden));
CREATE INDEX votes_exp ON votes(exp,kind,garden);
