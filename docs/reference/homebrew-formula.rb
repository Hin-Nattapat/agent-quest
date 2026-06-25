# Mirrors the live formula in the tap repo Hin-Nattapat/homebrew-tap (Formula/agent-quest.rb).
# Per release: bump `url` to the new tag and `sha256` to: curl -fsSL <url> | shasum -a 256
class AgentQuest < Formula
  desc "Gamify your AI coding agent usage into an RPG"
  homepage "https://github.com/Hin-Nattapat/agent-quest"
  url "https://github.com/Hin-Nattapat/agent-quest/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "169971d6636802ba6922961420a76c09c2fdefa6d9ffd9ea3ac2289c15bc8113"
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
    assert_match "Usage:  aq", shell_output("#{bin}/aq --help")
  end
end
