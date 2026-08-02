_ALP_=~/alp
_UN_=~/unspendable
. $_ALP_/alp.bash
: . "/home/john/.deno/env"
# source /home/john/.local/share/bash-completion/completions/deno.bash

# bun
# export BUN_INSTALL="$HOME/.bun"
# export PATH="$BUN_INSTALL/bin:$PATH:."

d.date.W () 
{ 
    date "+%W"
}
d.date.u () 
{ 
    date "+%u"
}

D_DIR="/home/john/daisy"
D_LOC="$D_DIR/scripts"
D_NOW="$D_LOC/2026/$(a.date.W)"
D_LIB="$D_DIR/lib"

d.f() {
: 
    declare -f --  $*;
    d.f_() {
    : undefined
}

}

d.env() {
    - "D_DIR="$D_DIR;
    - "D_LOC="$D_LOC;
    - "D_NOW="$D_NOW;
    - "D_LIB="$D_LIB;
    - DAISY_LIB
}

d.now ()
{
    - $D_NOW;
    function d.now_ ()
    {
        cd $(d.now)
    }
    function d.now__ () 
    {
	mkdir $(d.now)
    }
}

mkdir $D_NOW 2>/dev/null
#source $DAISY_LOC/daisy.bash

#cd $DAISY_LIB
#source start.src 
#cd 
#

d.fs () 
{ 
    : : finds an -advanced satoshi code- friendly small hash;
    local _FS
    _FS=$(- $1-$(d.f $1 | d.s));
    d.f $1 > $_FS;
    - $_FS

- "Daisy, daisy, give me an answer do..."
    d.fs_ () 
    { 
       : : Replaces CRC sum with shasum;
       _FS=$(- $1-$(d.f $1 | d.s));
       d.f $1 > $_FS;
       - $_FS
   };
}
# d.h ----------------------------------------------
d.h () 
{ 
    : d.h;
    : : herstory;
    : : transforms the previous shell command into a function;
    : : usage: d.h d.name;
    local name;
    local raw;
    local body;
    local def;
    name="$1";
    if [ -z "$name" ]; then
        printf '%s\n' "usage: d.h function.name" 1>&2;
        return 1;
    fi;
    case "$name" in 
        [0-9]* | *[!A-Za-z0-9_.]*)
            printf '%s\n' "d.h: bad function name: $name" 1>&2;
            printf '%s\n' "d.h: allowed: letters numbers underscore dot" 1>&2;
            return 1
        ;;
    esac;
    raw=$(HISTTIMEFORMAT= history 2 | head -1);
    body=$(printf '%s\n' "$raw" | sed 's/^[[:space:]]*[0-9][0-9]*[[:space:]]*//');
    if [ -z "$body" ]; then
        printf '%s\n' "d.h: could not read previous command" 1>&2;
        return 1;
    fi;
    case "$body" in 
        d.h | d.h\ * | "$name")
            printf '%s\n' "d.h: previous command looks recursive" 1>&2;
            return 1
        ;;
    esac;
    def=$(printf '%s\n' "$name ()" "{" "    $body;" "}");
    printf '%s\n' "$def";
    eval "$def"
}
# dh -- 02794346 -----------------------------------
#
#
#
d.dark() {
- ~/daisy/2026/darkStar
:;
d.dark_() {
    cd $(d.dark);
    }
}

d.chisel_() {
- ~/daisy/2026/chisel-git
:;
d.chisel() {
    cd $(d.chisel_);
    }
}
d.termux_() {
- ./daisy/scripts/2026/28/droid.termux-35565.1
}

d.net() {
ip address show eth0 | grep "inet " | while read a b c d e
do
	- $d
done;
}

d.web() {
ps -ef | grep http.server | while read a b c
do
	- $a 
	- $b
	- $c
done
nohup python3 -m http.server 8000 &

}

## chisel
#
export CHISEL_ROOT="$HOME/daisy/2026/chisel-git"
export PATH="$CHISEL_ROOT/tools/chisel-cli/:$PATH"

# >>> Codex installer >>>
export PATH="/home/john/.local/bin:$PATH"
# <<< Codex installer <<<
