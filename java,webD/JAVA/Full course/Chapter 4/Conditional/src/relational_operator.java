public class relational_operator {
    public static void main(String[] args) {
        boolean a = true;
        boolean b = false;
        if (a && b){
            System.out.println("y");
        }
        else {
            System.out.println("n");
        }
        if (a || b){
            System.out.println("y");
        }
        else {
            System.out.println("n");
        }
        System.out.print("For logical not gate : ");
        System.out.println("For NOT(A)");
        System.out.println(!a);
        System.out.println("For NOT(B)");
        System.out.println(!b);
    }
}