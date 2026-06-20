# Classify a shell command string into a CmdTag (core/events.ts), or "" if none.
# Shared by every adapter's tool hook so the ladder lives in exactly one place.
def cmd_tag($c):
  if   ($c|test("git\\s+rebase\\b.*--onto")) then "git_rebase_onto"
  elif ($c|test("git\\s+rebase\\b.*(-i|--interactive)")) then "git_rebase_i"
  elif ($c|test("git\\s+cherry-pick")) then "cherry_pick"
  elif ($c|test("git\\s+push\\b.*(--force|-f\\b)")) then "force_push"
  elif ($c|test("git\\s+bisect")) then "bisect"
  elif ($c|test("git\\s+reflog")) then "reflog"
  elif ($c|test("git\\s+stash")) then "stash"
  elif ($c|test("gh\\s+pr\\s+merge")) then "pr_merge"
  elif ($c|test("git\\s+(push|merge)\\b.*\\b(main|master|prod|production|uat)\\b")) then "cowboy"
  elif ($c|test("(bun|npm|pnpm|yarn)\\s+(run\\s+)?test|pytest|go\\s+test|jest|vitest|cargo\\s+test|mocha|rspec")) then "test_run"
  else "" end;
