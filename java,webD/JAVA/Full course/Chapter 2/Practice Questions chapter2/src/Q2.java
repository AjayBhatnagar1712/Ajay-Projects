public class Q2 {
    public static void main(String[] args) {
        //This is to incement number as when we increment without specifing again char in lhs it will give error
        char c = 'A';
        c =(char) (c + 8);
        System.out.println(c);
        char d = 'I';
        d =(char) (d - 8);
        System.out.println(d);
    }
}
