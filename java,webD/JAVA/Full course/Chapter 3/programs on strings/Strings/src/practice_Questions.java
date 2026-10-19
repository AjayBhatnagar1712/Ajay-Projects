public class practice_Questions {
    public static void main(String[] args) {
        //Q1
        String name = "kartik";
        String uppername = name.toUpperCase();
        System.out.println(uppername);

        //Q2
        String name1 = "     Kartik     ";
        System.out.println(name1.replace(" " , "_"));

        //Q3
        String str = "\"Dear <|name|>,Thanks a lot\"";
        System.out.println(str.replace("<|name|>","sone name"));

        //Q4
        String name2 = "My Name is   Ajay";
        System.out.println(name2.indexOf("  "));
        System.out.println(name2.indexOf("   "));

        //Q5
        System.out.println(" \"Harry this course is nice \" ");
    }
}
