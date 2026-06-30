# Tabla maestra CORREGIDA (estructura justa)

Regla: ganador de zona → directo a la llave; la **ronda** (ajuste) es SOLO entre perdedores; se cuadra con byes; llave = potencia de 2.
El TOTAL es idéntico al formato actual (el arreglo es de justicia, no de costo).
⚠️ = caso límite (N = 2^k−1): se resuelve con llave de arriba + 1 bye al mejor sembrado.

| N | Zona | Bye zona | Perdedores | Ronda (solo perdedores) | Llave | Byes llave | Octavos | Cuartos | Semis | Final | TOTAL | Nota |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|:--|
| **8** | 4 | · | 4 | · | 8 | · | · | 4 | 2 | 1 | **11** | potencia justa: todos entran, sin ronda ni byes |
| **9** | 4 | 1 | 4 | 1 | 8 | · | · | 4 | 2 | 1 | **12** | llave 8; 4 perdedores → 3 entran por ronda (1 part.) |
| **10** | 5 | · | 5 | 2 | 8 | · | · | 4 | 2 | 1 | **14** | llave 8; 5 perdedores → 3 entran por ronda (2 part.) |
| **11** | 5 | 1 | 5 | 3 | 8 | · | · | 4 | 2 | 1 | **15** | llave 8; 5 perdedores → 2 entran por ronda (3 part.) |
| **12** | 6 | · | 6 | 4 | 8 | · | · | 4 | 2 | 1 | **17** | llave 8; 6 perdedores → 2 entran por ronda (4 part.) |
| **13** | 6 | 1 | 6 | · | 16 | 3 | 8 | 4 | 2 | 1 | **18** | llave 16; 3 bye(s) a los mejores; sin ronda |
| **14** | 7 | · | 7 | · | 16 | 2 | 8 | 4 | 2 | 1 | **20** | llave 16; 2 bye(s) a los mejores; sin ronda |
| **15** | 7 | 1 | 7 | · | 16 | 1 | 8 | 4 | 2 | 1 | **21** | llave 16; 1 bye(s) a los mejores; sin ronda |
| **16** | 8 | · | 8 | · | 16 | · | 8 | 4 | 2 | 1 | **23** | potencia justa: todos entran, sin ronda ni byes |
| **17** | 8 | 1 | 8 | 1 | 16 | · | 8 | 4 | 2 | 1 | **24** | llave 16; 8 perdedores → 7 entran por ronda (1 part.) |
| **18** | 9 | · | 9 | 2 | 16 | · | 8 | 4 | 2 | 1 | **26** | llave 16; 9 perdedores → 7 entran por ronda (2 part.) |
| **19** | 9 | 1 | 9 | 3 | 16 | · | 8 | 4 | 2 | 1 | **27** | llave 16; 9 perdedores → 6 entran por ronda (3 part.) |
| **20** | 10 | · | 10 | 4 | 16 | · | 8 | 4 | 2 | 1 | **29** | llave 16; 10 perdedores → 6 entran por ronda (4 part.) |
| **21** | 10 | 1 | 10 | 5 | 16 | · | 8 | 4 | 2 | 1 | **30** | llave 16; 10 perdedores → 5 entran por ronda (5 part.) |
| **22** | 11 | · | 11 | 6 | 16 | · | 8 | 4 | 2 | 1 | **32** | llave 16; 11 perdedores → 5 entran por ronda (6 part.) |
| **23** | 11 | 1 | 11 | 7 | 16 | · | 8 | 4 | 2 | 1 | **33** | llave 16; 11 perdedores → 4 entran por ronda (7 part.) |
| **24** | 12 | · | 12 | 8 | 16 | · | 8 | 4 | 2 | 1 | **35** | llave 16; 12 perdedores → 4 entran por ronda (8 part.) |
| **25** | 12 | 1 | 12 | · | 32 | 7 | 8 | 4 | 2 | 1 | **36** | llave 32; 7 bye(s) a los mejores; sin ronda |
| **26** | 13 | · | 13 | · | 32 | 6 | 8 | 4 | 2 | 1 | **38** | llave 32; 6 bye(s) a los mejores; sin ronda |
| **27** | 13 | 1 | 13 | · | 32 | 5 | 8 | 4 | 2 | 1 | **39** | llave 32; 5 bye(s) a los mejores; sin ronda |
| **28** | 14 | · | 14 | · | 32 | 4 | 8 | 4 | 2 | 1 | **41** | llave 32; 4 bye(s) a los mejores; sin ronda |
| **29** | 14 | 1 | 14 | · | 32 | 3 | 8 | 4 | 2 | 1 | **42** | llave 32; 3 bye(s) a los mejores; sin ronda |
| **30** | 15 | · | 15 | · | 32 | 2 | 8 | 4 | 2 | 1 | **44** | llave 32; 2 bye(s) a los mejores; sin ronda |
| **31** | 15 | 1 | 15 | · | 32 | 1 | 8 | 4 | 2 | 1 | **45** | llave 32; 1 bye(s) a los mejores; sin ronda |
| **32** | 16 | · | 16 | · | 32 | · | 8 | 4 | 2 | 1 | **47** | potencia justa: todos entran, sin ronda ni byes |
| **33** | 16 | 1 | 16 | 1 | 32 | · | 8 | 4 | 2 | 1 | **48** | llave 32; 16 perdedores → 15 entran por ronda (1 part.) |
| **34** | 17 | · | 17 | 2 | 32 | · | 8 | 4 | 2 | 1 | **50** | llave 32; 17 perdedores → 15 entran por ronda (2 part.) |
| **35** | 17 | 1 | 17 | 3 | 32 | · | 8 | 4 | 2 | 1 | **51** | llave 32; 17 perdedores → 14 entran por ronda (3 part.) |
| **36** | 18 | · | 18 | 4 | 32 | · | 8 | 4 | 2 | 1 | **53** | llave 32; 18 perdedores → 14 entran por ronda (4 part.) |
| **37** | 18 | 1 | 18 | 5 | 32 | · | 8 | 4 | 2 | 1 | **54** | llave 32; 18 perdedores → 13 entran por ronda (5 part.) |
| **38** | 19 | · | 19 | 6 | 32 | · | 8 | 4 | 2 | 1 | **56** | llave 32; 19 perdedores → 13 entran por ronda (6 part.) |
| **39** | 19 | 1 | 19 | 7 | 32 | · | 8 | 4 | 2 | 1 | **57** | llave 32; 19 perdedores → 12 entran por ronda (7 part.) |
| **40** | 20 | · | 20 | 8 | 32 | · | 8 | 4 | 2 | 1 | **59** | llave 32; 20 perdedores → 12 entran por ronda (8 part.) |
| **41** | 20 | 1 | 20 | 9 | 32 | · | 8 | 4 | 2 | 1 | **60** | llave 32; 20 perdedores → 11 entran por ronda (9 part.) |
| **42** | 21 | · | 21 | 10 | 32 | · | 8 | 4 | 2 | 1 | **62** | llave 32; 21 perdedores → 11 entran por ronda (10 part.) |
| **43** | 21 | 1 | 21 | 11 | 32 | · | 8 | 4 | 2 | 1 | **63** | llave 32; 21 perdedores → 10 entran por ronda (11 part.) |
| **44** | 22 | · | 22 | 12 | 32 | · | 8 | 4 | 2 | 1 | **65** | llave 32; 22 perdedores → 10 entran por ronda (12 part.) |
| **45** | 22 | 1 | 22 | 13 | 32 | · | 8 | 4 | 2 | 1 | **66** | llave 32; 22 perdedores → 9 entran por ronda (13 part.) |
| **46** | 23 | · | 23 | 14 | 32 | · | 8 | 4 | 2 | 1 | **68** | llave 32; 23 perdedores → 9 entran por ronda (14 part.) |
| **47** | 23 | 1 | 23 | 15 | 32 | · | 8 | 4 | 2 | 1 | **69** | llave 32; 23 perdedores → 8 entran por ronda (15 part.) |
| **48** | 24 | · | 24 | 16 | 32 | · | 8 | 4 | 2 | 1 | **71** | llave 32; 24 perdedores → 8 entran por ronda (16 part.) |
| **49** | 24 | 1 | 24 | · | 64 | 15 | 8 | 4 | 2 | 1 | **72** | llave 64; 15 bye(s) a los mejores; sin ronda |
| **50** | 25 | · | 25 | · | 64 | 14 | 8 | 4 | 2 | 1 | **74** | llave 64; 14 bye(s) a los mejores; sin ronda |
| **51** | 25 | 1 | 25 | · | 64 | 13 | 8 | 4 | 2 | 1 | **75** | llave 64; 13 bye(s) a los mejores; sin ronda |
| **52** | 26 | · | 26 | · | 64 | 12 | 8 | 4 | 2 | 1 | **77** | llave 64; 12 bye(s) a los mejores; sin ronda |
| **53** | 26 | 1 | 26 | · | 64 | 11 | 8 | 4 | 2 | 1 | **78** | llave 64; 11 bye(s) a los mejores; sin ronda |
| **54** | 27 | · | 27 | · | 64 | 10 | 8 | 4 | 2 | 1 | **80** | llave 64; 10 bye(s) a los mejores; sin ronda |
| **55** | 27 | 1 | 27 | · | 64 | 9 | 8 | 4 | 2 | 1 | **81** | llave 64; 9 bye(s) a los mejores; sin ronda |
| **56** | 28 | · | 28 | · | 64 | 8 | 8 | 4 | 2 | 1 | **83** | llave 64; 8 bye(s) a los mejores; sin ronda |
| **57** | 28 | 1 | 28 | · | 64 | 7 | 8 | 4 | 2 | 1 | **84** | llave 64; 7 bye(s) a los mejores; sin ronda |
| **58** | 29 | · | 29 | · | 64 | 6 | 8 | 4 | 2 | 1 | **86** | llave 64; 6 bye(s) a los mejores; sin ronda |
| **59** | 29 | 1 | 29 | · | 64 | 5 | 8 | 4 | 2 | 1 | **87** | llave 64; 5 bye(s) a los mejores; sin ronda |
| **60** | 30 | · | 30 | · | 64 | 4 | 8 | 4 | 2 | 1 | **89** | llave 64; 4 bye(s) a los mejores; sin ronda |
| **61** | 30 | 1 | 30 | · | 64 | 3 | 8 | 4 | 2 | 1 | **90** | llave 64; 3 bye(s) a los mejores; sin ronda |
| **62** | 31 | · | 31 | · | 64 | 2 | 8 | 4 | 2 | 1 | **92** | llave 64; 2 bye(s) a los mejores; sin ronda |
| **63** | 31 | 1 | 31 | · | 64 | 1 | 8 | 4 | 2 | 1 | **93** | llave 64; 1 bye(s) a los mejores; sin ronda |
| **64** | 32 | · | 32 | · | 64 | · | 8 | 4 | 2 | 1 | **95** | potencia justa: todos entran, sin ronda ni byes |
