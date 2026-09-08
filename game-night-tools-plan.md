# Game Night Tools — Refined Plan

Bracket generator + team randomizer + stat tracker, integrated, with persistence.

---

## 1. Verdict

**This is the best-validated idea in the whole search, and the gap you identified is real.**

I checked the competition properly this time:

| What exists | What it does | What it doesn't |
|---|---|---|
| Challonge, start.gg, Toornament, Score7, Brackify | Brackets — all formats, mature, mostly free | One-off events. No cross-tournament stats, no team generation, no recurring groups |
| Keamk, PickerWheel, CommentPicker, dozens more | Team randomizing, some with constraints | Completely stateless. Nothing saves |
| RivalBoard, Scored, Board Games Tracker | Persistent group stats and leaderboards | No brackets, no team generation |

Every piece exists. **Nobody joins them.** The tournament platforms are built for organizers running a one-off esports event; the trackers are built for board-game groups logging scores. Nothing serves *the same ten friends playing every Saturday* — roster → balanced teams → bracket → results that persist and accumulate.

Your instinct about persistence is the correct wedge. "It's annoying when you load the site again and it's all gone" is the actual complaint, and it's unaddressed.

---

## 2. The realization worth more than the feature list

**This is the same product as the golf league app and Hoots.**

Strip all three to their bones and you get an identical core:

```
Group  →  Members  →  Event  →  Teams  →  Results  →  Standings
```

- **Golf league app** = that core + golf scoring and handicaps
- **Hoots** = that core + sports rosters and messaging
- **This** = that core + brackets and randomization

You've now described three variants of "manage a recurring competitive group." Build the engine once and each of them becomes a *game module* on top of it, not a separate project. That turns three half-started ideas into one product with three entry points — and the bracket suite is the best entry point because it's the one with a real gap and no sales required.

---

## 3. Features

### Tournament brackets — yours, specified properly

| Format | Notes |
|---|---|
| **Single elimination** | Byes for non-power-of-2 counts. Seeding: manual, random, or by rating |
| **Double elimination** | Winners + losers brackets with correct drop routing. **Add a "grand final bracket reset" toggle** — whether the losers-bracket winner must beat the winners-bracket winner twice. Competitive players care about this a lot and most free tools get it wrong |
| **Round robin** | Circle method. Single or double round. Configurable points (win/draw/loss) and tiebreakers |
| **Swiss** | Rounds = ⌈log₂(n)⌉. Pairing must avoid rematches; Buchholz for tiebreaks |
| **Free-for-all** | Lobbies of N, multiple rounds, points by placement, advancement rules. **This is the one Pummel Party actually needs** and almost nothing supports it well |

Plus your asks: **3rd-place match toggle**, and optional **title / description / rules** shown on the bracket page.

Double elimination and Swiss are the real engineering here. Everything else is a weekend; those two are where the bugs live.

### Best-of series

You asked for Bo3/Bo5 as an option when only two teams exist. Worth going further: **make `best_of` a property of a match, not of the tournament.** Real tournaments run Bo1 in early rounds, Bo3 in semis, Bo5 in the final — that's the standard pattern, and it costs nothing extra to support.

- `Match.best_of` ∈ {1, 3, 5, 7}, defaulted per round at generation time, overridable per match by the host
- `Match.score` holds series wins: `{"a": 2, "b": 1}` — the match resolves when a side reaches ⌈best_of / 2⌉
- Tournament settings carry the defaults: `{"best_of": {"default": 1, "semifinal": 3, "final": 5}}`

Your two-team case falls straight out of this: a 2-entrant tournament *is* one match, so setting Bo5 on it gives you a series. And a nice touch for the team generator — **when it produces exactly two teams, skip the bracket entirely and offer a best-of series instead.** A bracket for two teams is just ceremony.

### Players, friends and rosters

Three connected features, and the identity model is the part to get right.

**Two-layer identity.** An entrant has an *optional account link* and a *per-event display label*, exactly as you described:

```
(        ) [Player 1]              ← no account, ad-hoc name
(Brett   ) [Custom Nickname]       ← linked account, event nickname
(Daenen  ) [Pig Benis]             ← linked account, event nickname
```

The label lives on the **Entrant**, not the person — so Daenen can be "Pig Benis" in Saturday's Pummel Party night and "Shim" in the LoL customs, and both resolve to the same account for stats. That separation is the whole trick; without it you're stuck picking one name per person forever.

**Why link accounts at all?** A nickname alone is enough to run an event. Linking earns you three things: the player sees the tournament in their own account, their stats accumulate to their real profile *across different hosts' events*, and they can report their own results. That's the reason the friend system exists — cross-group stat continuity.

**Friends.** Standard request/accept. Adding a friend creates a roster entry linked to their account. Keep one consent rule in the model from the start: a linked player can see events they've been added to and can leave one. Don't build heavy moderation for it, but don't build a system where anyone can attach stats to your account with no recourse either.

**Saved roster — the quality-of-life feature that makes the app sticky.** Names typed once are saved and become clickable chips next time:

- Logged out → `localStorage`, so it works with no signup at all
- Logged in → stored server-side, syncs across devices
- On signup, the local list merges into the account
- Sort by most recently used, show last-played date, allow archiving someone who's drifted out of the group

This is the single highest ratio of user-delight to engineering effort in the whole plan. Re-typing ten names every Saturday is precisely the friction that sends people back to a random generator, and killing it costs you an afternoon.

**Late joiners.** Someone signs up after the event is created. This works cleanly for some formats and not others, and the honest constraint is worth designing around rather than hiding:

| Tournament state | Behaviour |
|---|---|
| `draft` (not yet started) | Add and remove entrants freely. Bracket regenerates |
| `active` — Swiss | **Natural.** They enter the next round on 0 points |
| `active` — Round robin | **Works.** Generate their fixtures; already-passed rounds mark as unplayed |
| `active` — Free-for-all | **Natural.** Add them to the next round's lobbies |
| `active` — Single/double elim | **Not possible** without regenerating. Offer two honest choices: regenerate the bracket (clears results, with a confirmation), or add them as a substitute for a future event |

Elimination brackets are a fixed tree — you can't insert a node without rebuilding it. Say so in the UI plainly rather than silently doing something surprising. Team generator has no such problem: add the player to a team, or re-roll.

### Team generator — yours, extended

Your constraint — "these two can't be on the same team" — plus:

- **NEW** — "these two *must* be together" (couples, carpools, the two who only play together)
- **NEW** — lock a specific player to a specific team
- **NEW** — balance by player rating rather than pure random
- **NEW** — avoid repeating last week's teams
- Uneven group handling (who sits out, or who plays 2v3)

Implementation: randomize → validate constraints → retry, capped at a few thousand attempts. For groups under ~30 that's instant and you don't need a real constraint solver.

### Stat tracking — yours, generalized

Your model is right: separate tables per game and mode. Generalize it as **Group → Game → Mode**, with all stats scoped to that triple. Pummel Party Solo and Pummel Party Teams are different modes of the same game; ARAM and Summoner's Rift likewise.

Track: wins, losses, win rate, games played, current and longest streak, placement distribution for FFA.

---

## 4. My additions

**NEW 1 — Player ratings that feed back into team generation** *(the key one)*

Results build a per-player, per-game Elo. That rating then drives balanced team generation. Play games → ratings sharpen → teams get fairer → more games worth playing.

**This is what makes it one product instead of three tools sharing a domain.** Without it you've built Challonge and Keamk next to each other. With it, each part makes the others better, and that's a thing no competitor can copy without building all three.

**NEW 2 — Spectator links, no account required**

Every bracket and leaderboard gets a read-only public URL. The organizer signs up; nine friends just click a link. That's your entire acquisition channel and it costs nothing — the product markets itself every time someone runs a game night.

**NEW 3 — Live updates**

WebSocket push so every open bracket updates the moment a result is entered. This is what makes your second-monitor thesis actually work — the tab is worth leaving open because it's *live*, not because it's parked.

**NEW 4 — Discord bot**

Post the bracket to the channel, report results with a slash command, ping whoever's up next. Your entire audience is already on Discord, and this is the "build on top of Discord rather than replacing it" idea from earlier — you inherit the network instead of fighting it. Likely your single best distribution channel.

**NEW 5 — Seasons**

Stats archive and reset on a cadence the group chooses. Gives a competitive arc, a reason to care in month six, and a natural "season 3 starts Monday" moment that pulls people back.

**NEW 6 — No-account quick start**

Let someone build a bracket in ten seconds with no signup, then prompt to save it at the end. Friction at the front is what kills tools like this — Challonge's signup wall is a real part of why people paste names into a random generator instead.

**NEW 7 — Head-to-head and nemesis stats**

"You're 3–11 against Mark" is the most shareable thing a friend group produces. Cheap to compute from data you already have, and it's the screenshot that gets posted back into the Discord.

**NEW 8 — Paste-a-list roster import**

Organizers already have their names somewhere. Accept a pasted list or CSV, one name per line.

**NEW 9 — Match history and "on this day"**

Return-visit driver, and free nostalgia content from data you're already storing.

**NEW 10 — Handicaps**

Optional point adjustments for uneven groups, so the strongest player doesn't make game night pointless.

**NEW 11 — Substitutions**

Someone rage-quits or their internet dies mid-tournament. Swap an entrant for a replacement while keeping the bracket and results intact — the slot persists, the person in it changes. Same code path as late joins, and it's the thing that will actually come up on a real game night.

**NEW 12 — Co-hosts**

Once friends exist in the system, the obvious next want is letting a trusted friend report results too — so the host isn't the single bottleneck for entering scores all night. Three roles is enough: host, co-host (report results), spectator (read only).

---

## 5. Data model

```python
class Group(models.Model):                    # "Saturday Crew"
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    owner = models.ForeignKey(User, on_delete=models.PROTECT)

class Friendship(models.Model):
    from_user = models.ForeignKey(User, related_name="sent_requests", on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name="received_requests", on_delete=models.CASCADE)
    status = models.CharField(max_length=10, default="pending")   # pending / accepted / blocked
    class Meta:
        constraints = [models.UniqueConstraint(fields=["from_user","to_user"], name="uniq_friendship")]

class Player(models.Model):
    """An entry in a host's saved roster. May or may not be a real account.
       This is what powers the clickable name chips when creating an event."""
    owner = models.ForeignKey(User, related_name="roster", on_delete=models.CASCADE)
    group = models.ForeignKey(Group, null=True, blank=True,
                              related_name="players", on_delete=models.CASCADE)
    display_name = models.CharField(max_length=60)                # default name
    user = models.ForeignKey(User, null=True, blank=True,         # the (Brett) link
                             related_name="player_profiles", on_delete=models.SET_NULL)
    last_used_at = models.DateTimeField(null=True, db_index=True) # for "recently played" ordering
    archived = models.BooleanField(default=False)

class Game(models.Model):                     # Pummel Party, League of Legends
    name = models.CharField(max_length=80)
    group = models.ForeignKey(Group, null=True, on_delete=models.CASCADE)   # null = global preset

class GameMode(models.Model):                 # Solo, Teams / ARAM, Rift
    game = models.ForeignKey(Game, related_name="modes", on_delete=models.CASCADE)
    name = models.CharField(max_length=60)
    is_team_based = models.BooleanField(default=False)

class Tournament(models.Model):
    FORMATS = [("single","Single elim"),("double","Double elim"),
               ("rr","Round robin"),("swiss","Swiss"),("ffa","Free-for-all")]
    STATES = [("draft","Draft"),("active","Active"),("complete","Complete")]
    group = models.ForeignKey(Group, related_name="tournaments", on_delete=models.CASCADE)
    mode = models.ForeignKey(GameMode, on_delete=models.PROTECT)
    season = models.ForeignKey("Season", null=True, on_delete=models.SET_NULL)
    format = models.CharField(max_length=8, choices=FORMATS)
    state = models.CharField(max_length=8, choices=STATES, default="draft")  # gates late joins
    title = models.CharField(max_length=140, blank=True)
    description, rules = models.TextField(blank=True), models.TextField(blank=True)
    third_place_match = models.BooleanField(default=False)
    settings = models.JSONField(default=dict)        # bracket reset, points, best_of defaults
    public_slug = models.SlugField(unique=True)      # spectator link

class Entrant(models.Model):
    """A participant in ONE tournament — a single player or a generated team.
       `label` is the per-event nickname: the [Pig Benis] half."""
    tournament = models.ForeignKey(Tournament, related_name="entrants", on_delete=models.CASCADE)
    label = models.CharField(max_length=80)
    players = models.ManyToManyField(Player, blank=True)   # the (Brett) half, may be empty
    seed = models.IntegerField(null=True)
    joined_round = models.IntegerField(default=0)          # >0 = late entry
    replaced_by = models.ForeignKey("self", null=True, blank=True,   # substitutions
                                    related_name="replaces", on_delete=models.SET_NULL)

class Participation(models.Model):
    """Only for entrants linked to a real account — lets a player see and leave
       events they've been added to, and keeps stats attributable."""
    entrant = models.ForeignKey(Entrant, related_name="participations", on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, default="active")   # active / left / disputed

class Role(models.Model):
    tournament = models.ForeignKey(Tournament, related_name="roles", on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10)      # host / cohost

class Match(models.Model):
    tournament = models.ForeignKey(Tournament, related_name="matches", on_delete=models.CASCADE)
    round_no, position = models.IntegerField(), models.IntegerField()
    bracket = models.CharField(max_length=8, default="main")     # main / losers / final
    a = models.ForeignKey(Entrant, null=True, related_name="+", on_delete=models.CASCADE)
    b = models.ForeignKey(Entrant, null=True, related_name="+", on_delete=models.CASCADE)
    winner = models.ForeignKey(Entrant, null=True, related_name="+", on_delete=models.SET_NULL)
    best_of = models.IntegerField(default=1)         # 1 / 3 / 5 / 7
    score = models.JSONField(default=dict)           # {"a": 2, "b": 1} — series wins
    next_match_win = models.ForeignKey("self", null=True, related_name="+", on_delete=models.SET_NULL)
    next_match_lose = models.ForeignKey("self", null=True, related_name="+", on_delete=models.SET_NULL)

    @property
    def wins_needed(self):
        return self.best_of // 2 + 1

class Rating(models.Model):                   # per player, per mode
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    mode = models.ForeignKey(GameMode, on_delete=models.CASCADE)
    elo = models.FloatField(default=1200)
    games = models.IntegerField(default=0)
```

`next_match_win` / `next_match_lose` is the trick that makes every format work with one advancement routine: generate the match graph up front, then reporting a result just pushes entrants along the edges. Double elimination becomes data rather than special-case code.

Standings are computed from `Match`, not stored — no denormalized counters to drift out of sync.

**The `Player` / `Entrant` split is the other load-bearing decision.** `Player` is a durable person in someone's roster; `Entrant` is that person's participation in one specific tournament, carrying the per-event nickname. Ratings hang off `Player`, labels hang off `Entrant`. Collapse those two and you can never let someone be "Pig Benis" on Saturday and "Shim" on Sunday while keeping one stat line — and you'd be surprised how fast that becomes the thing people complain about.

For logged-out hosts, the roster lives in `localStorage` under the same shape as `Player`, so signup is a straight bulk-insert with no translation layer.

**Stack:** Django + DRF + Postgres, Next.js frontend, Redis for WebSocket fanout. Hosting $60–90/month all in. No media storage, no voice, no third-party API fees.

---

## 6. Monetization — with one trap to avoid

### The trap: an SPA generates one ad impression per session

A React app that never changes route fires **one** ad impression no matter how long it's open. You have to explicitly refresh ad slots on an interval and on view changes. This single implementation detail is a 25× swing:

| Impressions/session | Monthly at 5,000 users, $3 RPM |
|---|---|
| 1 | $60 |
| 5 | $300 |
| 15 | $900 |
| 25 | $1,500 |
| 40 | $2,400 |

### Revenue by scale

Assuming 4 sessions/user/month, ~25 viewable impressions per session (long sessions with 60-second refresh):

| Users | Sessions/mo | Impressions | @ $2 | @ $3 | @ $5 |
|---|---|---|---|---|---|
| 500 | 2,000 | 50,000 | $100 | $150 | $250 |
| 2,000 | 8,000 | 200,000 | $400 | $600 | $1,000 |
| 5,000 | 20,000 | 500,000 | $1,000 | **$1,500** | $2,500 |
| 20,000 | 80,000 | 2,000,000 | $4,000 | $6,000 | $10,000 |

### Ads beat subscriptions here — which is the opposite of the golf league app

A group of ten shares **one** potential subscriber but generates **ten** users' worth of ad impressions:

| Groups | Players | Subs @15% conversion, $5/mo |
|---|---|---|
| 200 | 2,000 | $150 |
| 500 | 5,000 | $375 |
| 2,000 | 20,000 | $1,500 |

At 5,000 players: **ads $1,500, subscriptions $375.** Run ads as the primary model, with a small Pro tier (ad-free, custom branding, unlimited active tournaments, CSV export) as a supplement — roughly $1,875/month combined against $60–90 in costs.

### Honest caution on the second-monitor thesis

It's plausible, but most ad networks **pause refresh when a tab loses focus**, and viewability requires pixels actually in view. A visible-but-unfocused second-monitor tab is genuinely ambiguous territory. Don't build the plan on it — instrument it early and find out what your real impressions-per-session number is before you assume the 25.

---

## 7. Build order

Your feature list is a year. Cut it to something that ships.

| Version | Scope | Effort |
|---|---|---|
| **v1** | Single elim only. Paste names → bracket → click winners → save → spectator link. Per-entrant nicknames. **Saved roster in localStorage** — it's cheap and it's the first thing that makes the app feel worth returning to. No accounts (claim via a secret URL) | 1 weekend |
| **v2** | Accounts, Groups, server-side rosters (merging the local list on signup). Round robin. Best-of series | 2 weekends |
| **v3** | Team generator with constraints. Stat tracking per game/mode. Friends: request, accept, add linked players to events | 2 weekends |
| **v4** | Double elimination + bracket reset. Ratings feeding team balance. Late joins, substitutions, co-hosts | 2 weekends |
| **v5** | Swiss, FFA, seasons, live updates | ongoing |
| **v6** | Discord bot | 1 weekend, and probably your best growth spend |

Note that the saved roster moved into **v1**. It's an afternoon of work backed by `localStorage`, it needs no accounts, and it's the feature most likely to make someone use the site a second time — which is the only thing v1 is trying to find out.

**Ship v1 before building v2.** A single-elim bracket that saves and shares is already better than what most people reach for, and it tells you whether anyone cares before you write a Swiss pairing algorithm.

---

## 8. Risks

| Risk | Response |
|---|---|
| **Challonge is free, mature and entrenched** | Don't compete on brackets. Compete on the loop — persistence, teams, ratings, recurring groups. Being worse at one-off esports events is fine |
| **SPA ad impressions** | Explicit slot refresh from day one. It's a 25× revenue difference |
| **Second-monitor viewability doesn't pay** | Instrument early, don't assume |
| **Double elim and Swiss are bug farms** | Unit-test the bracket generators hard — 3 to 64 entrants, byes, odd counts. This is where a wrong bracket destroys trust instantly |
| **Signup friction** | No-account quick start. Prompt to save *after* they've built something |
| **Scope** | Six versions above. v1 is one weekend |
| **Late joins on elimination brackets** | Structurally impossible without a rebuild. Gate it on tournament state and say so in the UI — a silent regenerate that wipes results is far worse than a clear refusal |
| **Linked accounts attaching stats without consent** | `Participation` with a leave/dispute status from the start. Cheap now, painful to retrofit |

---

## 9. Why this one is worth building

It passes every filter that killed the others:

- **No giant to fight.** Challonge is a mature tool, not a $20B network-effect company, and it doesn't do what you'd be doing
- **No IP or data-licensing risk.** It's your own data, generated by your own users
- **Costs $60–90/month**, flat, and doesn't scale with usage
- **You're the user.** You already run Pummel Party nights and LoL customs — you'll know when something feels wrong, which is worth more than any market research
- **It unifies three projects you've already started** instead of adding a fourth
- **v1 ships in a weekend**
