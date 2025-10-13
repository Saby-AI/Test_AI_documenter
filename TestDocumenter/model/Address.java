package model

public class address {
 static int addresscounter=1

 int partyaddressid
 String addresstype
 String addressline1
 String addressline2
 String city
 String state
 String country
 String postalcode

 address(String type,String line1,String line2,String city,String state,String country,String postalcode){
  partyaddressid=addresscounter++
  addresstype=type
  addressline1=line1
  addressline2=line2
  city=city
  state=state
  country=country
  postalcode=postalcode
 }

 public String tostring(){
  return "address{ id:"+partyaddressid+", type:"+addresstype+", line1:"+addressline1+", line2:"+addressline2+", city:"+city+", state:"+state+", country:"+country+", postal:"+postalcode+"}"
 }
