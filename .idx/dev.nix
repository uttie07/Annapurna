# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.11"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_22
    pkgs.rustup
    pkgs.pkg-config
    pkgs.stdenv.cc
    pkgs.openssl
    pkgs.libiconv
    pkgs.glib
    pkgs.gtk3
    pkgs.webkitgtk
    pkgs.pango
    pkgs.cairo
    pkgs.gdk-pixbuf
    pkgs.atk
    pkgs.harfbuzz
    pkgs.libsoup
    pkgs.libsoup_3
    pkgs.dbus
    pkgs.zlib
  ];
  # Sets environment variables in the workspace
  env = {
    # 全てのライブラリのパスを PKG_CONFIG_PATH に連結します
    PKG_CONFIG_PATH = "${pkgs.glib.dev}/lib/pkgconfig:${pkgs.gtk3.dev}/lib/pkgconfig:${pkgs.webkitgtk_4_1.dev}/lib/pkgconfig:${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.pango.dev}/lib/pkgconfig:${pkgs.cairo.dev}/lib/pkgconfig:${pkgs.gdk-pixbuf.dev}/lib/pkgconfig:${pkgs.atk.dev}/lib/pkgconfig:${pkgs.harfbuzz.dev}/lib/pkgconfig:${pkgs.libsoup_3.dev}/lib/pkgconfig:${pkgs.dbus.dev}/lib/pkgconfig:${pkgs.librsvg.dev}/lib/pkgconfig:${pkgs.zlib.dev}/lib/pkgconfig";
    LIBRARY_PATH = "${pkgs.zlib}/lib";
  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
      "google.gemini-cli-vscode-ide-companion"
    ];
    workspace = {
      # Runs when a workspace is first created with this `dev.nix` file
      onCreate = {
        npm-install = "npm i --no-audit --no-progress --timing";
        # Open editors for the following files by default, if they exist:
        default.openFiles = [ "src/App.tsx" "src/App.ts" "src/App.jsx" "src/App.js" ];
      };
      # To run something each time the workspace is (re)started, use the `onStart` hook
    };
    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}
