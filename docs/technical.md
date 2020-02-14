# technical documentation

## initialization

1. load or setup internal configuration database

* version mapping   
    * known databases store there database versions and an "setup" version
    - i.e. database "global" use 3 (third version change) and store "pets" is at version 1
    - i.e. store "pets" update to version 2 "global" migrate all known stores to current global and don't trigger upgrade needed
