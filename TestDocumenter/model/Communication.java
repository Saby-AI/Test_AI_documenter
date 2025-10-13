package model

public class communication{
 public String contacttype
 public String contact;

 communication(String type, String cont){
  contacttype=type
  contact=cont
  if(!valid(type,cont)){
    throw new IllegalArgumentException("bad contact "+type)
  }
 }

 boolean valid(String a,String b){
  if(a.toLowerCase()=="email"){
   return b.matches("[\\w.-]+@[\\w.-]+\\.\\w{2,}")
  }else if(a=="phone"||a=="fax"){
   return b.matches("\\+?[0-9\\- ]{7,15}")
  }else{
   return false;
  }
 }

 public String tostring(){
  return "Comm{" + "type:"+contacttype+", contact:"+contact+"}"
 }
}
