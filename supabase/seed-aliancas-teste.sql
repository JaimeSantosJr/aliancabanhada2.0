-- Catálogo de teste — 9 alianças (fotos em /products/*.png)
-- Opcional: use se preferir rodar no SQL Editor em vez do script scripts/seed-aliancas.mjs
-- Atenção: apaga produtos atuais.

delete from public.products;

insert into public.products (name, description, price, image_url, category, material, size_range, in_stock, slug)
values
(
  'Aliança Canal Escovada',
  'Aliança em tom de ouro com face externa escovada (acetinada), canal central polido e brilhante, e bordas chanfradas espelhadas. Interior liso e polido. Perfil flat com chanfro.',
  189.90,
  '/products/alianca-canal-escovada.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-canal-escovada'
),
(
  'Aliança Flat com Pedra',
  'Aliança em tom de ouro com perfil flat e acabamento polido. Uma pedra redonda clara cravada no centro da face externa. Bordas levemente chanfradas. Interior liso e polido.',
  219.90,
  '/products/alianca-flat-pedra.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-flat-pedra'
),
(
  'Aliança Fosca Floral com Pedra',
  'Aliança em tom de ouro com face externa fosca/jateada e gravura orgânica floral sutil. Pedra redonda clara cravada no centro. Bordas arredondadas (comfort fit). Interior liso e polido.',
  229.90,
  '/products/alianca-fosca-floral-pedra.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-fosca-floral-pedra'
),
(
  'Aliança Bicolor Diagonais',
  'Aliança bicolor: interior e bordas chanfradas em tom de ouro polido; face central em tom prata/aço escovado. Detalhes diagonais em ouro com textura em linhas paralelas. Perfil flat com chanfro.',
  249.90,
  '/products/alianca-bicolor-diagonais.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-bicolor-diagonais'
),
(
  'Aliança Bicolor com Canal',
  'Aliança bicolor: interior e bordas em ouro polido; duas faixas laterais em tom prata escovado; canal central fino em ouro polido. Perfil flat com bordas chanfradas.',
  239.90,
  '/products/alianca-bicolor-canal.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-bicolor-canal'
),
(
  'Aliança Escovada Chanfrada',
  'Aliança lisa em tom de ouro, sem pedras. Faixa central escovada (acetinada) e bordas chanfradas altamente polidas. Interior liso e polido. Perfil flat moderno.',
  179.90,
  '/products/alianca-escovada-chanfrada.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-escovada-chanfrada'
),
(
  'Aliança Jateada (par)',
  'Modelo de aliança em tom de ouro com centro jateado/fosco cintilante e bordas chanfradas polidas. Foto de referência mostra o par. Preço unitário; use a opção de par no produto para comprar as duas.',
  199.90,
  '/products/alianca-par-jateada.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-par-jateada'
),
(
  'Aliança Meio Brilho Meio Glitter',
  'Aliança em tom de ouro com face dividida: metade superior polida espelhada e metade inferior com textura glitter/jateada. Separadas por um filete/canal horizontal fino. Interior liso.',
  209.90,
  '/products/alianca-meio-brilho-glitter.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-meio-brilho-glitter'
),
(
  'Aliança Batimentos',
  'Aliança em tom de ouro com centro jateado/cintilante, bordas polidas e gravura de batimentos cardíacos (ECG) na face externa e também no interior. Interior liso e polido.',
  259.90,
  '/products/alianca-batimentos.png',
  'alianca',
  'Ouro banhado',
  '12,13,14,15,16,17,18,19,20,21,22,23,24',
  true,
  'alianca-batimentos'
);
