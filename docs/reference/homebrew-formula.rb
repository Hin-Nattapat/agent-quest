# Live copy lives in the tap repo Hin-Nattapat/homebrew-agent-quest as Formula/agent-quest.rb.
# Update `url` + `sha256` to each new release tag. sha256: curl -fsSL <url> | shasum -a 256
class AgentQuest < Formula
  desc "Gamify your AI coding agent usage into an RPG"
  homepage "https://github.com/Hin-Nattapat/agent-quest"
  url "https://github.com/Hin-Nattapat/agent-quest/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "REPLACE_WITH_TARBALL_SHA256"
  license "MIT"

  depends_on "bun"
  depends_on "jq"

  def install
    libexec.install "adapters", "core", "tools", "hud", "scripts", "config"
    (bin/"aq").write <<~SH
      #!/bin/bash
      exec bun "#{libexec}/tools/aq.ts" "$@"
    SH
  end

  def caveats
    <<~EOS
      Run `aq setup` to deploy the engine to ~/.agentrpg and wire your coding agent(s).
      Re-run `aq setup` after `brew upgrade` to refresh the deployed engine.
    EOS
  end

  test do
    assert_match "Usage: aq", shell_output("#{bin}/aq 2>&1", 1)
  end
end
