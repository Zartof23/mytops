-- Recovered from the remote migration history on 2026-08-16.
-- Already applied in production; do not re-apply remotely.

-- Seed items for testing rating functionality
-- Movies
INSERT INTO items (topic_id, name, slug, description, source) VALUES
  ('0f1d0103-d8ff-44f5-bfb8-c26699a4ed68', 'Inception', 'inception', 'A thief who steals corporate secrets through dream-sharing technology', 'seed'),
  ('0f1d0103-d8ff-44f5-bfb8-c26699a4ed68', 'The Matrix', 'the-matrix', 'A computer hacker learns about the true nature of reality', 'seed'),
  ('0f1d0103-d8ff-44f5-bfb8-c26699a4ed68', 'Interstellar', 'interstellar', 'A team of explorers travel through a wormhole in space', 'seed'),
  ('0f1d0103-d8ff-44f5-bfb8-c26699a4ed68', 'The Dark Knight', 'the-dark-knight', 'Batman faces the Joker in Gotham City', 'seed'),
  ('0f1d0103-d8ff-44f5-bfb8-c26699a4ed68', 'Pulp Fiction', 'pulp-fiction', 'The lives of two mob hitmen intertwine in a series of incidents', 'seed');

-- Series
INSERT INTO items (topic_id, name, slug, description, source) VALUES
  ('058745dd-56b4-48c7-92ce-79491351a16a', 'Breaking Bad', 'breaking-bad', 'A high school chemistry teacher turns to cooking meth', 'seed'),
  ('058745dd-56b4-48c7-92ce-79491351a16a', 'Game of Thrones', 'game-of-thrones', 'Noble families fight for control of the Iron Throne', 'seed'),
  ('058745dd-56b4-48c7-92ce-79491351a16a', 'The Office', 'the-office', 'A mockumentary on a group of office workers', 'seed'),
  ('058745dd-56b4-48c7-92ce-79491351a16a', 'Stranger Things', 'stranger-things', 'A group of kids uncover supernatural mysteries', 'seed');

-- Books
INSERT INTO items (topic_id, name, slug, description, source) VALUES
  ('0e88a0c7-5001-48c2-b791-9395194fea48', '1984', '1984', 'A dystopian novel by George Orwell', 'seed'),
  ('0e88a0c7-5001-48c2-b791-9395194fea48', 'To Kill a Mockingbird', 'to-kill-a-mockingbird', 'A novel about racial injustice in the American South', 'seed'),
  ('0e88a0c7-5001-48c2-b791-9395194fea48', 'The Great Gatsby', 'the-great-gatsby', 'A story of the mysteriously wealthy Jay Gatsby', 'seed'),
  ('0e88a0c7-5001-48c2-b791-9395194fea48', 'Dune', 'dune', 'A science fiction epic set on the desert planet Arrakis', 'seed');

-- Anime
INSERT INTO items (topic_id, name, slug, description, source) VALUES
  ('a8968965-bd7f-450a-8096-6d83235da70b', 'Attack on Titan', 'attack-on-titan', 'Humanity fights for survival against giant humanoids', 'seed'),
  ('a8968965-bd7f-450a-8096-6d83235da70b', 'Death Note', 'death-note', 'A student discovers a notebook that can kill anyone', 'seed'),
  ('a8968965-bd7f-450a-8096-6d83235da70b', 'Fullmetal Alchemist', 'fullmetal-alchemist', 'Two brothers search for the Philosophers Stone', 'seed'),
  ('a8968965-bd7f-450a-8096-6d83235da70b', 'One Piece', 'one-piece', 'A pirate crew searches for the ultimate treasure', 'seed');

-- Games
INSERT INTO items (topic_id, name, slug, description, source) VALUES
  ('9eeb0f7b-761f-4f10-9945-58265135205f', 'The Legend of Zelda', 'the-legend-of-zelda', 'Link embarks on a quest to save Princess Zelda', 'seed'),
  ('9eeb0f7b-761f-4f10-9945-58265135205f', 'Elden Ring', 'elden-ring', 'An action RPG set in a vast open world', 'seed'),
  ('9eeb0f7b-761f-4f10-9945-58265135205f', 'The Witcher 3', 'the-witcher-3', 'Geralt of Rivia hunts monsters in a fantasy world', 'seed'),
  ('9eeb0f7b-761f-4f10-9945-58265135205f', 'Red Dead Redemption 2', 'red-dead-redemption-2', 'An outlaw gang in Americas Old West', 'seed');;
