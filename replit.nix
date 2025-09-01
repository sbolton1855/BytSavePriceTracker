{ pkgs }: {
  deps = [
    pkgs.nodejs-20_x
    pkgs.yarn
    pkgs.replitPackages.jest
    pkgs.replitPackages.typescript
    pkgs.replitPackages.prettier
    pkgs.replitPackages.eslint
  ];
} 