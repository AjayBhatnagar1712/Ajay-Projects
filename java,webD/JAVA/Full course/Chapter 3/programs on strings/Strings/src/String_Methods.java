public class String_Methods {
    public static void main(String[] args) {
        //To get the lenth of the string.
        String name = "Ajay";
        System.out.println(name);
        int length = name.length();
        System.out.println(length);
        //To uppercase and lower case
        String upper = name.toUpperCase();
        System.out.println(upper);
        String lower = name.toLowerCase();
        System.out.println(lower);
        //To trim extra spaces in a string
        String Totrim = "    Ajay    ";
        System.out.println(Totrim);
        System.out.println(Totrim.trim());
        String nontrimmed = "           Ajay       ";
        String trimmed = nontrimmed.trim();
        System.out.println(trimmed);
        //To Print a substring
        String Substring = "AjayBhatnagar";
        System.out.println(Substring.substring(3));
        String name1 = "AjayBhatnagar";
        System.out.println(name1.substring(3,8));
        //To change a character in the string
        System.out.println(name1.replace('a','p'));
        System.out.println(name1.replace("tn","rj"));
        //To check initials and endinng of string
        System.out.println(name1.startsWith("Aj"));
        System.out.println(name1.endsWith("tr"));
        //To get the character at a index or to geet the value at a particular index or int the particular range of index and with somme constraints.
        System.out.println(name1.charAt(4));
        System.out.println(name1.indexOf("r"));
        System.out.println(name1.indexOf("ha"));
        String modifiedname = "Ajajajaja";
        System.out.println(modifiedname.indexOf("aj",3));
        System.out.println(modifiedname.lastIndexOf("ja"));
        System.out.println(modifiedname.lastIndexOf("ja",5));
        System.out.println(modifiedname.equals("Ajajajaja"));
        System.out.println(modifiedname.equalsIgnoreCase("ajajaJAja"));
        //Escape sequence
        System.out.println("I am escape sezuence \" double quote ");
        System.out.println("I am escape sequence for \\ back slash");
    }
}
