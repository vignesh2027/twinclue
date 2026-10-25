# Twinclue

**Two streamers. Two communities. Each holds half of every clue.**

Twinclue is a cooperative puzzle show for Twitch collabs. When two streamers stream together, each stream's
overlay shows a different half of the same puzzle. Neither community can solve it alone: viewers in each chat
see something the other chat needs, and the streamers have to talk to each other on stream to put the halves
together. Chat answers count only when both communities contribute.

It is built for the moment Twitch made possible with Shared Chat and Stream Together: two audiences in one room
who usually just watch each other. Twinclue gives them a reason to talk.

## Who it is for

- Streamers who collab (co-op games, podcasts, IRL duos, tabletop) and want a segment that mixes their communities.
- Viewers, who get a game where their chat matters and where they meet the other community.

## How a round works

1. The streamers start a round from the control panel (or a mod types `!tc start`).
2. A puzzle is generated with two halves, for example:
   - Half A (shown on stream A): "A city with a five-letter name that has hosted the Summer Olympics more than once."
   - Half B (shown on stream B): "It sits on a river that flows into the English Channel."
   Half A alone fits Paris and Tokyo; half B alone fits many cities. Together only Paris fits.
3. Each overlay shows only its half, with a timer.
4. Viewers type guesses in their own chat (`!g paris`). The referee accepts close spellings and synonyms.
5. A round is won only when at least one viewer from **each** community has a correct guess, so the
   communities must cooperate. The overlay celebrates both communities together and credits the first solver on
   each side by name.
6. A scoreboard tracks the duo's streak across rounds. A recap is posted at the end.

## Twitch integration (real, not mocked)

- A bot account reads both channels through **EventSub over WebSocket** (`channel.chat.message`), using the
  `user:read:chat` and `user:bot` scopes on the bot and `channel:bot` granted by each broadcaster.
- The bot replies in each chat with **Send Chat Message** (`POST /helix/chat/messages`).
- When the streamers use **Shared Chat**, Twinclue listens for `channel.shared_chat.begin`, `update` and `end`
  and uses `source_broadcaster_user_id` on chat messages to tell which community a viewer belongs to, so it works
  inside one merged chat as well as across two separate chats.
- Optional: a **Channel Points** reward ("Buy a hint") through `channel.channel_points_custom_reward_redemption.add`.
- The overlays are browser sources (`/overlay/a` and `/overlay/b`) that update over a WebSocket.

## The AI parts

- **Puzzle generator:** an LLM writes puzzles as structured JSON (answer, accepted aliases, half A, half B,
  difficulty), and code verifies that neither half contains the answer or an alias, and that both halves are
  needed. Puzzles failing the checks are discarded.
- **Referee:** guesses are normalised in code first (case, accents, punctuation, edit distance). Only unclear
  guesses go to the model.
- **Recap:** after the session, a short recap for both chats and a shareable recap page.
- The model provider is configurable. Default: an OpenAI-compatible endpoint set in `.env`.
- A built-in pack of hand-checked puzzles makes the game work with no model at all.

## Streamer control panel

`/panel`: connect both channels, start or skip a round, pick a category (general, games, music, science, local
city, custom), set difficulty and round length, see both chats side by side, and a big "end session" button.

## Safety and moderation

- Messages that Twitch AutoMod or the channel blocks never reach the game; guesses are length-limited.
- Generated puzzle text is checked against a blocklist before it is shown on stream.
- Tokens live in `.env` and a local file, never in the repository or the overlay.

## Non-goals

- Not a general chatbot, not a summariser, not a translation tool.
