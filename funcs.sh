function findBillsPerDate()
{

if [ $# -ne 1 ]
  then
    usage $FUNCNAME "month/year";
    echo "e.g: $FUNCNAME 2018"
    echo "e.g: $FUNCNAME 01/2018"
    echo "e.g: $FUNCNAME 29/01/2018"
    echo "e.g: $FUNCNAME '[01|02]/2018'"
  else
    year=$1
    for f in $(find . -name 'bill*.json'); do 

      matches=$(jq .billingDate $f | egrep $year | wc -l);

      if [ $matches -eq 1 ]
      then
        echo $f
	type=$(jq '.type' $f)
	amounts=$(jq '.items[] | select(.id | contains("LOUKAS")) | .amount' $f)
	echo $type: $amounts
      fi
    done
fi
}
