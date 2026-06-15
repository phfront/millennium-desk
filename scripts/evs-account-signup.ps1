# Cria conta EVS (gratuita) para assinatura VMP de producao.
# https://github.com/castlabs/electron-releases/wiki/EVS

py -3 -m pip install --upgrade castlabs-evs
py -3 -m castlabs_evs.account signup
